"""Novelread 1.0: persistent local reading and publishing platform."""
import hashlib
import json
import re
import hmac
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

def same_origin(request: Request):
    origin = request.headers.get("origin")
    if request.method not in ("GET", "HEAD") and origin and urlparse(origin).netloc != request.headers.get("host"):
        raise HTTPException(403, "ไม่อนุญาตคำขอจากเว็บไซต์อื่น")

router = APIRouter(prefix="/api/library", dependencies=[Depends(same_origin)])
DB = Path(os.environ.get("NOVELREAD_DB", str(Path(__file__).resolve().parents[1] / "data" / "novelread.db")))

@contextmanager
def connect():
    DB.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        with db:
            yield db
    finally:
        db.close()

def initialize():
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS books(id INTEGER PRIMARY KEY,owner INTEGER REFERENCES users(id),title TEXT NOT NULL,pen_name TEXT NOT NULL,summary TEXT NOT NULL,category TEXT NOT NULL,tags TEXT NOT NULL,cover TEXT NOT NULL,rating TEXT NOT NULL,status TEXT NOT NULL,updated REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS chapters(id INTEGER PRIMARY KEY,book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,title TEXT NOT NULL,content TEXT NOT NULL,published INTEGER NOT NULL,position INTEGER NOT NULL,updated REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS shelf(user_id INTEGER REFERENCES users(id),book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,chapter_id INTEGER,progress REAL NOT NULL DEFAULT 0,followed INTEGER NOT NULL DEFAULT 0,updated REAL NOT NULL,PRIMARY KEY(user_id,book_id));
        """)
        columns = {row[1] for row in db.execute("PRAGMA table_info(shelf)")}
        if "anchor" not in columns:
            db.execute("ALTER TABLE shelf ADD COLUMN anchor TEXT")

initialize()

def fail(code, message):
    raise HTTPException(code, message)

def user(request: Request):
    token = request.cookies.get("novelread_session", "")
    with connect() as db:
        row = db.execute("SELECT u.id,u.email,u.name FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?", (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
    return dict(row) if row else None

def required(request: Request):
    current = user(request)
    if not current:
        fail(401, "กรุณาเข้าสู่ระบบก่อน")
    if request.method not in ("GET", "HEAD"):
        origin = request.headers.get("origin")
        if origin and urlparse(origin).netloc != request.headers.get("host"):
            fail(403, "ไม่อนุญาตคำขอจากเว็บไซต์อื่น")
    return current

def owned(db, book_id, current):
    book = db.execute("SELECT * FROM books WHERE id=?", (book_id,)).fetchone()
    if not book:
        fail(404, "ไม่พบเรื่องนี้")
    if book["owner"] != current["id"]:
        fail(403, "แก้ไขได้เฉพาะผลงานของคุณ")
    return book

class Account(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=80)

def password_hash(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 260000).hex()

def session(db, response, uid):
    token = secrets.token_urlsafe(32)
    db.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
    db.execute("INSERT INTO sessions VALUES(?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), uid, time.time()+30*86400))
    response.set_cookie("novelread_session", token, httponly=True, samesite="strict", max_age=30*86400)

@router.post("/register")
def register(data: Account, response: Response):
    email = data.email.strip().lower()
    if "@" not in email or not data.name.strip():
        fail(400, "กรอกอีเมลและนามปากกาให้ครบ")
    salt = secrets.token_hex(16)
    with connect() as db:
        try:
            uid = db.execute("INSERT INTO users(email,name,password) VALUES(?,?,?)", (email, data.name.strip(), salt+":"+password_hash(data.password,salt))).lastrowid
        except sqlite3.IntegrityError:
            fail(409, "อีเมลนี้มีบัญชีแล้ว")
        session(db,response,uid)
    return {"id": uid,"email":email,"name":data.name.strip()}

@router.post("/login")
def login(data: Account, response: Response):
    with connect() as db:
        row = db.execute("SELECT * FROM users WHERE email=?", (data.email.strip().lower(),)).fetchone()
        salt, expected = row["password"].split(":") if row else ("00"*16, "")
        if not hmac.compare_digest(password_hash(data.password,salt),expected):
            fail(401,"อีเมลหรือรหัสผ่านไม่ถูกต้อง")
        session(db,response,row["id"])
    return {k:row[k] for k in ("id","email","name")}

@router.get("/me")
def me(request: Request):
    return user(request)

@router.post("/logout")
def logout(request: Request,response:Response,current=Depends(required)):
    with connect() as db:
        db.execute("DELETE FROM sessions WHERE token=?", (hashlib.sha256(request.cookies.get("novelread_session", "").encode()).hexdigest(),))
    response.delete_cookie("novelread_session")
    return {"ok":True}

class Profile(BaseModel):
    name: str = Field(min_length=1,max_length=80)

@router.put("/profile")
def profile(data:Profile,current=Depends(required)):
    if not data.name.strip(): fail(400,"กรอกนามปากกา")
    with connect() as db:
        db.execute("UPDATE users SET name=? WHERE id=?",(data.name.strip(),current["id"]))
    return {**current,"name":data.name.strip()}

class Book(BaseModel):
    title: str = Field(min_length=1,max_length=200)
    pen_name: str = Field(min_length=1,max_length=80)
    summary: str = Field(default="",max_length=10000)
    category: str = Field(default="แฟนตาซี",max_length=80)
    tags: str = Field(default="",max_length=300)
    cover: str = Field(default="",max_length=2000)
    rating: str = "ทั่วไป"
    status: str = "กำลังเขียน"

def validate_book(data):
    if not data.title.strip() or not data.pen_name.strip(): fail(400,"กรอกชื่อเรื่องและนามปากกา")
    if data.rating not in ("ทั่วไป","18+") or data.status not in ("กำลังเขียน","จบแล้ว"): fail(400,"สถานะหรือเรตไม่ถูกต้อง")
    uploaded = re.fullmatch(r"/api/library/covers/[a-f0-9]{64}\.(png|jpg|webp)", data.cover)
    if data.cover and not uploaded and urlparse(data.cover).scheme not in ("http","https"): fail(400,"ลิงก์ปกต้องเป็น http หรือ https หรือปกที่อัปโหลด")

@router.get("/books")
def books(request:Request,q:str="",category:str="",status:str="",mine:bool=False):
    current=user(request)
    if mine and not current: fail(401,"กรุณาเข้าสู่ระบบก่อน")
    with connect() as db:
        rows = db.execute("SELECT b.*, (SELECT COUNT(*) FROM chapters c WHERE c.book_id=b.id AND c.published=1) chapter_count FROM books b ORDER BY updated DESC").fetchall()
    return [dict(b) for b in rows if (b["owner"]==current["id"] if mine else b["chapter_count"]>0) and (not q or q.casefold() in (b["title"]+b["pen_name"]+b["tags"]).casefold()) and (not category or b["category"]==category) and (not status or b["status"]==status)]

@router.post("/books")
def create_book(data:Book,current=Depends(required)):
    validate_book(data)
    with connect() as db:
        uid=db.execute("INSERT INTO books(owner,title,pen_name,summary,category,tags,cover,rating,status,updated) VALUES(?,?,?,?,?,?,?,?,?,?)",(current["id"],*data.model_dump().values(),time.time())).lastrowid
    return {"id":uid}

@router.get("/authors/{author_id}")
def public_author(author_id:int, offset:int=Query(0, ge=0), limit:int=Query(12, ge=1, le=48), status:str=""):
    # Public identity comes from the stable owner key, never a pen-name match.
    with connect() as db:
        author = db.execute("SELECT id,name FROM users WHERE id=?", (author_id,)).fetchone()
        if not author: fail(404,"ไม่พบนักเขียน")
        where = "b.owner=? AND EXISTS (SELECT 1 FROM chapters c WHERE c.book_id=b.id AND c.published=1)"
        args = [author_id]
        if status:
            where += " AND b.status=?"
            args.append(status)
        total = db.execute(f"SELECT COUNT(*) FROM books b WHERE {where}", args).fetchone()[0]
        rows = db.execute(f"SELECT b.*, (SELECT COUNT(*) FROM chapters c WHERE c.book_id=b.id AND c.published=1) chapter_count FROM books b WHERE {where} ORDER BY b.updated DESC,b.id DESC LIMIT ? OFFSET ?", [*args,limit,offset]).fetchall()
    return {"author":dict(author),"books":[dict(row) for row in rows],"total":total,"next_offset":offset+len(rows) if offset+len(rows)<total else None}

@router.put("/books/{bid}")
def update_book(bid:int,data:Book,current=Depends(required)):
    validate_book(data)
    with connect() as db:
        owned(db,bid,current)
        db.execute("UPDATE books SET title=?,pen_name=?,summary=?,category=?,tags=?,cover=?,rating=?,status=?,updated=? WHERE id=?",(*data.model_dump().values(),time.time(),bid))
    return {"id":bid}

@router.get("/books/{bid}")
def book_detail(bid:int,request:Request):
    current=user(request)
    with connect() as db:
        b=db.execute("SELECT * FROM books WHERE id=?",(bid,)).fetchone()
        if not b: fail(404,"ไม่พบเรื่องนี้")
        owner=bool(current and b["owner"]==current["id"])
        chapters=db.execute("SELECT id,title,published,position,updated FROM chapters WHERE book_id=? AND (published=1 OR ?=1) ORDER BY position,id",(bid,int(owner))).fetchall()
        if not owner and not chapters: fail(404,"เรื่องนี้ยังไม่ได้เผยแพร่")
    return {**dict(b),"is_owner":owner,"chapters":[dict(c) for c in chapters]}

class Chapter(BaseModel):
    title:str=Field(min_length=1,max_length=200)
    content:str=Field(default="",max_length=200000)
    published:bool=False

def save_chapter(bid,data,current,cid=None):
    if not data.title.strip(): fail(400,"กรอกชื่อตอน")
    if data.published and not data.content.strip(): fail(400,"เพิ่มเนื้อหาก่อนเผยแพร่")
    with connect() as db:
        owned(db,bid,current)
        if cid:
            found=db.execute("SELECT id FROM chapters WHERE id=? AND book_id=?",(cid,bid)).fetchone()
            if not found: fail(404,"ไม่พบตอนนี้")
            db.execute("UPDATE chapters SET title=?,content=?,published=?,updated=? WHERE id=?",(data.title,data.content,int(data.published),time.time(),cid))
        else:
            position=db.execute("SELECT COALESCE(MAX(position),0)+1 FROM chapters WHERE book_id=?",(bid,)).fetchone()[0]
            cid=db.execute("INSERT INTO chapters(book_id,title,content,published,position,updated) VALUES(?,?,?,?,?,?)",(bid,data.title,data.content,int(data.published),position,time.time())).lastrowid
        db.execute("UPDATE books SET updated=? WHERE id=?",(time.time(),bid))
    return {"id":cid}

@router.post("/books/{bid}/chapters")
def create_chapter(bid:int,data:Chapter,current=Depends(required)):
    return save_chapter(bid,data,current)

@router.put("/books/{bid}/chapters/{cid}")
def update_chapter(bid:int,cid:int,data:Chapter,current=Depends(required)):
    return save_chapter(bid,data,current,cid)

class Order(BaseModel):
    ids:list[int]

@router.put("/books/{bid}/order")
def reorder(bid:int,data:Order,current=Depends(required)):
    with connect() as db:
        owned(db,bid,current)
        actual={c[0] for c in db.execute("SELECT id FROM chapters WHERE book_id=?",(bid,))}
        if len(data.ids)!=len(actual) or set(data.ids)!=actual: fail(400,"รายการตอนต้องครบและไม่ซ้ำ")
        for pos,cid in enumerate(data.ids,1): db.execute("UPDATE chapters SET position=? WHERE id=?",(pos,cid))
    return {"ok":True}

@router.get("/chapters/{cid}")
def chapter_detail(cid:int,request:Request):
    current=user(request)
    with connect() as db:
        c=db.execute("SELECT c.*,b.owner,b.title book_title FROM chapters c JOIN books b ON b.id=c.book_id WHERE c.id=?",(cid,)).fetchone()
        if not c or (not c["published"] and (not current or c["owner"]!=current["id"])): fail(404,"ไม่พบตอนที่เผยแพร่")
    return dict(c)

class ContentAnchor(BaseModel):
    paragraph: int = Field(ge=0)
    character: int = Field(ge=0)

class Reading(BaseModel):
    chapter_id:int|None=None
    progress:float=Field(default=0,ge=0,le=1)
    followed:bool|None=None
    anchor:ContentAnchor|None=None

@router.get("/shelf")
def shelf(current=Depends(required)):
    with connect() as db:
        rows = db.execute("SELECT b.*,s.chapter_id,s.progress,s.followed,s.anchor,s.updated reading_updated FROM shelf s JOIN books b ON b.id=s.book_id WHERE s.user_id=? ORDER BY s.updated DESC",(current["id"],)).fetchall()
        return [{**dict(r), "anchor": json.loads(r["anchor"]) if r["anchor"] else None} for r in rows]

@router.put("/shelf/{bid}")
def reading(bid:int,data:Reading,current=Depends(required)):
    with connect() as db:
        if not db.execute("SELECT id FROM books WHERE id=? AND (owner=? OR EXISTS(SELECT 1 FROM chapters WHERE book_id=books.id AND published=1))",(bid,current["id"])).fetchone(): fail(404,"ไม่พบเรื่องที่เผยแพร่")
        if data.chapter_id is not None:
            if not db.execute("SELECT id FROM chapters WHERE id=? AND book_id=? AND published=1",(data.chapter_id,bid)).fetchone(): fail(400,"ตอนนี้ยังไม่เผยแพร่หรืออยู่คนละเรื่อง")
        old=db.execute("SELECT * FROM shelf WHERE user_id=? AND book_id=?",(current["id"],bid)).fetchone()
        chapter=data.chapter_id if data.chapter_id is not None else (old["chapter_id"] if old else None)
        progress=data.progress if data.chapter_id is not None else (old["progress"] if old else 0)
        followed=int(data.followed) if data.followed is not None else (old["followed"] if old else 0)
        anchor = (json.dumps(data.anchor.model_dump()) if data.anchor else None) if data.chapter_id is not None else (old["anchor"] if old else None)
        db.execute("INSERT INTO shelf(user_id,book_id,chapter_id,progress,followed,updated,anchor) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET chapter_id=excluded.chapter_id,progress=excluded.progress,followed=excluded.followed,updated=excluded.updated,anchor=excluded.anchor",(current["id"],bid,chapter,progress,followed,time.time(),anchor))
    return {"ok":True}
