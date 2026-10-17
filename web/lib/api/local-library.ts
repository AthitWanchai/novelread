import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

function findProjectRoot() {
  let candidate = process.cwd();
  for (let depth = 0; depth < 4; depth += 1) {
    if (existsSync(join(candidate, "server.py"))) {
      return candidate;
    }
    candidate = dirname(candidate);
  }
  return process.cwd();
}

const ROOT = findProjectRoot();
const DB_PATH = process.env.NOVELREAD_DB ? resolve(process.env.NOVELREAD_DB) : join(ROOT, "data", "novelread.db");
const COVERS_DIR = join(dirname(DB_PATH), "covers");

class HttpError extends Error {
  readonly status: number;
  readonly detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

function fail(status: number, detail: string): never {
  throw new HttpError(status, detail);
}

const SHOWCASE_NOVELS = [
  {
    authorIdx: 0,
    title: "นครลอยฟ้าแห่งแสงจันทร์",
    summary: "เมื่อหอคอยดาราจักรที่หลับใหลกว่าสามร้อยปีเริ่มสั่นสะเทือน ‘อคิราห์’ นักซ่อมกลไกเวทฝึกหัดต้องร่วมมือกับแม่ทัพไร้เงาเพื่อไขปริศนาแห่งจันทราคราม ก่อนที่มหานครลอยฟ้าจะร่วงหล่นสู่ทะเลหมอกนิรันดร์",
    category: "แฟนตาซี",
    tags: "เวทมนตร์,นครลอยฟ้า,ผจญภัย,ดาราจักร",
    rating: "ทั่วไป",
    status: "กำลังเขียน",
    chapters: [
      {
        title: "เสียงเพรียกจากเฟืองดารา",
        content: "ลมหนาวพัดผ่านระเบียงหินอ่อนของหอคอยทิศเหนือ กลิ่นน้ำมันสนและละอองแร่จันทราลอยคลุ้งอยู่ในห้องซ่อมกลไกขนาดเล็ก อคิราห์วางแว่นขยายทองเหลืองลงบนโต๊ะไม้โอ๊ก ก่อนจะเงยหน้ามองเข็มนาฬิกาดาราจักรที่หยุดเดินมาตั้งแต่สมัยบรรพกาล\n\nทว่าในคืนที่พระจันทร์เต็มดวงทอแสงสีครามจัดจ้าน ฟันเฟืองวงในสุดกลับขยับเขยื้อนด้วยตัวเอง เสียงกังวานใสราวระฆังแก้วดังสะท้อนไปทั่วห้องโถงที่เงียบงัน\n\n“เป็นไปไม่ได้...” หญิงสาวพึมพำพลางเอื้อมมือแตะขอบวงแหวนทองคำขาว ความร้อนผ่าวแล่นปราดจากปลายนิ้วเข้าสู่หัวใจ พร้อมกับอักขระโบราณที่ค่อย ๆ สว่างวาบขึ้นทีละตัวอักษร",
      },
      {
        title: "พันธสัญญาใต้เงาเมฆ",
        content: "ยังไม่ทันที่แสงสีครามจะจางหาย ประตูไม้บานใหญ่ของหอคอยก็ถูกผลักเข้ามาอย่างแรง ชายหนุ่มในชุดคลุมสีนิลก้าวเข้ามาพร้อมกลิ่นอายของพายุฝน ดวงตาสีอำพันของเขาจับจ้องมาที่แกนเวทในมือของอคิราห์\n\n“อย่าขยับ ถ้าไม่อยากให้หอคอยทั้งหลังพังลงมา” เสียงทุ้มต่ำเอ่ยเตือนอย่างเคร่งขรึม\n\n“ท่านคือ... แม่ทัพคีรินทร์?” อคิราห์ถอยหลังครึ่งก้าว แต่มือยังคงกอดสมุดบันทึกของอาจารย์ไว้แน่น “ท่านรู้เรื่องที่แกนจันทรากำลังตื่นขึ้นใช่ไหม”",
      },
      {
        title: "แผนที่สู่ขอบฟ้าที่สาบสูญ",
        content: "คีรินทร์วางตราประจำตระกูลลงบนแท่นศิลา ทันใดนั้นภาพฉายสามมิติของหมู่เกาะลอยฟ้าทั้งเจ็ดก็ปรากฏขึ้นกลางอากาศ โดยมีจุดสีแดงกะพริบเตือนอยู่ที่ฐานรากของนครหลวง\n\n“เรามีเวลาไม่ถึงเจ็ดราตรี” เขาพูดเรียบ ๆ แต่แววตาจริงจัง “และเจ้าคือคนเดียวที่อ่านภาษาเฟืองโบราณออก อคิราห์... เจ้าจะหนีไปพร้อมชาวเมือง หรือจะลงไปที่ชั้นใต้เมฆกับข้า”",
      },
    ],
  },
  {
    authorIdx: 1,
    title: "คดีลับตรอกหมอกสีเทา",
    summary: "จดหมายเชิญไร้ชื่อผู้ส่งนำพา ‘สารวัตรกวิน’ เข้าสู่ตรอกเก่าแก่ริมแม่น้ำที่ไม่มีอยู่ในแผนที่กรุงเทพฯ ทุกเที่ยงคืนจะมีเสียงไวโอลินบรรเลงเพลงเดิมซ้ำ ๆ พร้อมกับเบาะแสของคดีฆาตกรรมเมื่อสิบสองปีก่อน",
    category: "สืบสวน",
    tags: "สืบสวนสอบสวน,ปริศนา,ระทึกขวัญ,คดีฆาตกรรม",
    rating: "13+",
    status: "กำลังเขียน",
    chapters: [
      {
        title: "ซองจดหมายตราครั่งสีเลือดนก",
        content: "ฝนเดือนตุลาคมตกพรำไม่ขาดสาย สารวัตรกวินหมุนซองจดหมายกระดาษปอนด์สีเหลืองหม่นในมือ ตราครั่งรูปนกฮูกคาบกุญแจคือสัญลักษณ์เดียวกับที่เคยพบในแฟ้มคดีเมื่อสิบสองปีก่อน—คดีที่ถูกสั่งปิดตายอย่างเป็นปริศนา\n\nภายในซองมีเพียงตั๋วรถรางเก่าคร่ำคร่าหนึ่งใบ กับข้อความสั้น ๆ ที่เขียนด้วยหมึกซึมสีดำสนิท:\n\n‘เที่ยงคืนตรง ที่ร้านนาฬิกาหมายเลขศูนย์ ตรอกหมอกสีเทา’",
      },
      {
        title: "ร้านนาฬิกาที่เดินถอยหลัง",
        content: "เมื่อก้าวพ้นซุ้มประตูอิฐมอญที่ปกคลุมด้วยเถาวัลย์ เสียงจอแจของถนนใหญ่ก็เงียบหายไปราวกับถูกตัดขาด โคมไฟก๊าซสองข้างทางส่องแสงสีส้มสลัวสะท้อนแอ่งน้ำขังบนพื้นหินกรวด\n\nหน้าร้านไม้สักสองชั้นมีป้ายทองเหลืองสลักเลข ‘0’ กวินผลักประตูเข้าไป เสียงกระดิ่งดังกรุ๊งกริ๊ง พร้อมกับกลิ่นชาเอิร์ลเกรย์อุ่น ๆ ที่เพิ่งรินเสร็จใหม่ ๆ ทั้งที่ในร้านไม่ควรมีใครอยู่เลย",
      },
      {
        title: "พยานคนที่สี่",
        content: "“คุณมาช้าไปสามนาทีนะ สารวัตร” เสียงหญิงสาวดังขึ้นจากมุมมืดหลังเคาน์เตอร์ไม้ เธอวางถ้วยกระเบื้องเคลือบลงตรงหน้าเขา แววตาคมกริบหลังกรอบแว่นทรงกลมฉายแววรู้ทัน\n\n“คุณเป็นใคร” กวินถามพลางวางมือใกล้ซองปืนตามสัญชาตญาณ\n\n“คนที่รู้ว่าคืนวันที่สิบสี่เดือนเจ็ด เกิดอะไรขึ้นบนดาดฟ้าตึกเก่า” เธอยิ้มบาง “นั่งลงสิคะ เรื่องนี้ยาวกว่าเพลงไวโอลินเพลงนั้นเสียอีก”",
      },
    ],
  },
  {
    authorIdx: 2,
    title: "ข้ามสะพานสุดขอบทวีป",
    summary: "บันทึกการเดินทางของคณะสำรวจ ‘วายุรุ่งอรุณ’ ที่ต้องเดินเท้าข้ามสะพานศิลาโบราณความยาวพันลี้ซึ่งเชื่อมระหว่างสองทวีป ท่ามกลางพายุทรายสีทอง สัตว์อสูรโบราณ และมิตรภาพที่ไม่มีวันสั่นคลอน",
    category: "ผจญภัย",
    tags: "สำรวจโลก,มิตรภาพ,สะพานโบราณ,แฟนตาซีผจญภัย",
    rating: "ทั่วไป",
    status: "จบแล้ว",
    chapters: [
      {
        title: "ก้าวแรกเหนือหุบเหวไร้ก้น",
        content: "เบื้องหน้าของพวกเราคือ ‘สะพานพันลี้’ สิ่งปลูกสร้างจากยุคบรรพกาลที่ทอดตัวยาวเหยียดฝ่าทะเลเมฆไปจนสุดสายตา เสาหินแต่ละต้นสูงเสียดฟ้าและสลักลวดลายของมังกรลมโบราณ\n\n“เช็กสัมภาระให้พร้อม!” เสียงหัวหน้าคณะตะโกนแข่งกับเสียงลมแรง “เมื่อก้าวข้ามธรณีประตูศิลาไปแล้ว จะไม่มีจุดพักจนกว่าจะถึงป้อมปราการที่สาม!”",
      },
      {
        title: "ค่ายพักแรมกลางพายุทรายทอง",
        content: "ตกดึก ลมจากหุบเหวพัดเอาละอองแร่เรืองแสงขึ้นมาเป็นสายราวกับทางช้างเผือก พวกเราล้อมวงรอบกองไฟเล็ก ๆ ในซอกกำแพงหิน แบ่งปันขนมปังปิ้งและซุปเนื้อตากแห้งร้อน ๆ\n\n“ดูนั่นสิ” นทีชี้ขึ้นไปบนยอดเสาหิน เงาของนกยักษ์ปีกสีเงินกำลังร่อนถลาอยู่ท่ามกลางละอองแสง เป็นภาพที่งดงามจนทุกคนลืมความเหนื่อยล้าไปชั่วขณะ",
      },
      {
        title: "อรุณรุ่งแห่งทวีปใหม่",
        content: "หลังการเดินทางอันยาวนานกว่าสี่สิบเก้าวัน แสงอาทิตย์แรกของฤดูใบไม้ผลิก็สาดส่องผ่านซุ้มประตูปลายสะพาน ผืนป่าสีมรกตและยอดเขาหิมะของทวีปตะวันออกปรากฏขึ้นเบื้องหน้า\n\nการเดินทางบทหนึ่งสิ้นสุดลง แต่ตำนานของพวกเราเพิ่งจะเริ่มต้นขึ้นเท่านั้น",
      },
    ],
  },
  {
    authorIdx: 0,
    title: "เพียงสายลมกระซิบรัก",
    summary: "จากคู่กัดสมัยมัธยมที่ต้องกลับมาทำงานร่วมกันในโปรเจกต์ฟื้นฟูเรือนไม้เก่าที่เชียงใหม่ ท่ามกลางกลิ่นกาแฟดริปยามเช้าและสายหมอกฤดูหนาว ความทรงจำที่เคยซ่อนไว้ในหน้าสมุดสเกตช์จึงค่อย ๆ ชัดเจนขึ้นอีกครั้ง",
    category: "รักโรแมนติก",
    tags: "โรแมนติก,อบอุ่นหัวใจ,เชียงใหม่,สถาปนิก",
    rating: "ทั่วไป",
    status: "จบแล้ว",
    chapters: [
      {
        title: "กลิ่นกาแฟในเช้าวันจันทร์",
        content: "พราวไม่คิดเลยว่าการรับงานออกแบบปรับปรุงคาเฟ่เรือนไม้โบราณในครั้งนี้ จะทำให้เธอต้องกลับมาเจอกับ ‘ภีม’ อดีตเพื่อนร่วมโต๊ะที่ชอบแอบวาดรูปการ์ตูนล้อเลียนเธอลงในสมุดเรียนเมื่อแปดปีก่อน\n\n“ไม่เจอกันนานนะพราว ยังชอบสั่งอเมริกาโน่ไม่หวานเหมือนเดิมเลย” เสียงทุ้มคุ้นหูดังขึ้นพร้อมกับแก้วเซรามิกอุ่น ๆ ที่วางลงตรงหน้า",
      },
      {
        title: "สมุดสเกตช์เล่มที่หายไป",
        content: "ระหว่างที่กำลังรื้อชั้นหนังสือเก่าในห้องใต้หลังคา หนังสือปกหนังสีน้ำตาลเล่มหนึ่งก็ร่วงลงมาเปิดออกตรงหน้าพราว ทุกหน้าในนั้นไม่ได้มีแค่ภาพล้อเลียนอย่างที่เธอเคยเข้าใจ แต่กลับเต็มไปด้วยภาพวาดรอยยิ้มของเธอในทุกฤดูกาลตลอดสามปีเต็ม",
      },
    ],
  },
  {
    authorIdx: 1,
    title: "ท่วงทำนองของดาวตก",
    summary: "เมื่อมือเปียโนหนุ่มผู้สูญเสียแรงบันดาลใจได้พบกับนักดาราศาสตร์หนุ่มที่มักจะขึ้นมาตั้งกล้องดูดาวบนดาดฟ้าหอพักเดียวกันทุกคืนวันศุกร์ บทเพลงที่ไม่มีโน้ตจึงเริ่มต้นขึ้นใต้ท้องฟ้าฤดูหนาว",
    category: "วาย",
    tags: "BoyLove,ดนตรี,ดูดาว,ฟีลกู๊ด",
    rating: "13+",
    status: "กำลังเขียน",
    chapters: [
      {
        title: "ดาดฟ้าชั้นสิบสอง",
        content: "คืนวันศุกร์เวลาห้าทุ่มครึ่ง ซันถือแก้วโกโก้ร้อนเดินขึ้นมาบนดาดฟ้าตึกเหมือนทุกสัปดาห์ แต่คืนนี้กลับมีชายหนุ่มร่างสูงในเสื้อสเวตเตอร์สีกรมท่ากำลังก้มปรับกล้องโทรทรรศน์อยู่ตรงมุมประจำของเขา\n\n“ขอโทษนะครับ ตรงนี้มีคนจองหรือยัง” ซันเอ่ยถามเบา ๆ\n\nอีกฝ่ายหันมายิ้มตาหยี “แชร์กันได้ครับ คืนนี้มีฝนดาวตกเจมินิดส์พอดีเลย”",
      },
      {
        title: "คอร์ดที่เจ็ดของคืนไร้จันทร์",
        content: "หลังจากคืนนั้น ทุกครั้งที่ซันซ้อมเปียโนในห้องพักชั้นสิบเอ็ด เขาจะเปิดหน้าต่างแง้มไว้เสมอ และทุกครั้งที่เพลงจบลง จะมีข้อความสั้น ๆ ส่งมาจากห้องข้างบนว่า ‘คืนนี้ดาวสว่างขึ้นเพราะเพลงของคุณอีกแล้วนะ’",
      },
    ],
  },
  {
    authorIdx: 2,
    title: "เงาไม้ในม่านฝน",
    summary: "เรื่องราวของครอบครัวตระกูลเก่าแก่ริมคลองบางกอกน้อย เมื่อพินัยกรรมฉบับสุดท้ายถูกเปิดอ่าน ความลับที่ถูกเก็บงำไว้ใต้ร่มเงาของเรือนไทยโบราณจึงค่อย ๆ เผยความจริงที่ทั้งงดงามและเจ็บปวด",
    category: "ดราม่า",
    tags: "ครอบครัว,พีเรียด,ชีวิต,ความลับ",
    rating: "13+",
    status: "จบแล้ว",
    chapters: [
      {
        title: "วันเปิดพินัยกรรม",
        content: "เสียงฟ้าร้องคำรามอยู่ไกล ๆ ขณะที่ทนายความประจำตระกูลค่อย ๆ คลี่กระดาษสาแผ่นสุดท้ายออก ท่ามกลางสายตาของทายาททั้งสี่คนที่ไม่ได้กลับมารวมตัวกันพร้อมหน้ามานานนับสิบปี",
      },
      {
        title: "จดหมายจากฤดูฝนปีนั้น",
        content: "ในกล่องไม้จันทน์หอมที่คุณย่าทิ้งไว้ให้หลานสาวคนเล็ก ไม่มีเครื่องเพชรแม้แต่ชิ้นเดียว มีเพียงภาพถ่ายขาวดำใบหนึ่งและจดหมายที่อธิบายเหตุผลของทุกการตัดสินใจ",
      },
    ],
  },
  {
    authorIdx: 0,
    title: "พันธสัญญามังกรหยก",
    summary: "ท่ามกลางศึกชิงความเป็นใหญ่แห่งแดนยุทธภพ ‘หลินอวี้’ หมอยาพเนจรผู้ครอบครองหยกวิญญาณโบราณต้องเดินทางฝ่าด่านหุบเขาเมฆาเพื่อรักษาคำสาปให้จอมยุทธ์หนุ่มผู้ถูกตราหน้าว่าเป็นกบฏ",
    category: "แฟนตาซี",
    tags: "กำลังภายใน,เทพเซียน,หมอยา,มังกร",
    rating: "13+",
    status: "กำลังเขียน",
    chapters: [
      {
        title: "โรงเตี๊ยมกลางหิมะ",
        content: "หิมะโปรยปรายลงมาปกคลุมหลังคาโรงเตี๊ยมไม้ไผ่ หลินอวี้รินน้ำชาสมุนไพรร้อน ๆ ลงในถ้วยดินเผา ก่อนที่ประตูไม้จะถูกพังเข้ามาพร้อมร่างของบุรุษในชุดเกราะเงินที่ชุ่มไปด้วยโลหิต",
      },
      {
        title: "หยกเรืองแสงในคืนเดือนมืด",
        content: "ทันทีที่ปลายนิ้วของหลินอวี้แตะลงบนชีพจรของชายแปลกหน้า จี้หยกที่ห้อยคออยู่ก็เปล่งประกายสีเขียวมรกตสว่างไสว บาดแผลฉกรรจ์เริ่มสมานตัวด้วยความเร็วอันน่าอัศจรรย์",
      },
    ],
  },
  {
    authorIdx: 1,
    title: "รหัสลับพิพิธภัณฑ์เที่ยงคืน",
    summary: "เมื่อภาพวาดโบราณในพิพิธภัณฑ์ศิลปะแห่งชาติถูกสับเปลี่ยนด้วยผลงานที่แนบเนียนไร้ที่ติ นักวิเคราะห์งานศิลปะสาวกับนักสืบเอกชนจอมกวนจึงต้องแท็กทีมกันตามล่าจอมโจรเงาจันทร์",
    category: "สืบสวน",
    tags: "จอมโจร,ศิลปะ,สืบสวน,คู่หู",
    rating: "ทั่วไป",
    status: "จบแล้ว",
    chapters: [
      {
        title: "รอยฝีแปรงที่เกินมาหนึ่งเส้น",
        content: "ไม่มีสัญญาณกันขโมยดังขึ้นแม้แต่วินาทีเดียว แต่ ‘มินตรา’ รู้ทันทีตั้งแต่ก้าวแรกที่เดินเข้าห้องจัดแสดงว่าภาพวาดสุริยุปราคาตรงหน้าไม่ใช่ของจริง เพราะรอยฝีแปรงตรงมุมซ้ายล่างซ่อนรหัสมอร์สเอาไว้",
      },
      {
        title: "คำเชิญบนหลังเฟรมผ้าใบ",
        content: "เมื่อส่องด้วยแสงอัลตราไวโอเลต ข้อความท้าทายจากจอมโจรเงาจันทร์ก็ปรากฏขึ้น พร้อมพิกัดของงานประมูลใต้ดินที่จะจัดขึ้นในคืนพรุ่งนี้",
      },
    ],
  },
  {
    authorIdx: 2,
    title: "บันทึกสถานีอวกาศหมายเลขเก้า",
    summary: "เรื่องราวชีวิตประจำวันแสนอบอุ่นของเจ้าหน้าที่ดูแลเรือนกระจกปลูกพืชบนสถานีอวกาศวงโคจรดาวพฤหัสบดี กับหุ่นยนต์ผู้ช่วยรุ่นเก่าที่ชอบชงชามะลิให้นักเดินทางข้ามดวงดาว",
    category: "อื่น ๆ",
    tags: "ไซไฟ,อวกาศ,อบอุ่นหัวใจ,เรือนกระจก",
    rating: "ทั่วไป",
    status: "กำลังเขียน",
    chapters: [
      {
        title: "ต้นส้มต้นแรกในวงโคจร",
        content: "แสงจากดวงจันทร์ยูโรปาสะท้อนผ่านโดมกระจกนิรภัยเข้ามาในเรือนเพาะชำหมายเลขสาม วันนี้ดอกส้มดอกแรกบานสะพรั่งท่ามกลางสภาวะแรงโน้มถ่วงจำลอง กลิ่นหอมอ่อน ๆ ลอยไปทั่วทางเดินโลหะสีเงิน",
      },
      {
        title: "แขกไม่ได้รับเชิญจากยานขนส่งแร่",
        content: "สัญญาณขอเทียบท่าฉุกเฉินดังขึ้นในเวลาตีสอง ยานสำรวจขนาดเล็กที่ตัวถังเต็มไปด้วยรอยสะเก็ดดาวตกค่อย ๆ เคลื่อนเข้ามาจอด พร้อมกับนักบินสาวที่ถือกล่องเมล็ดพันธุ์โบราณจากโลกมาด้วย",
      },
    ],
  },
];

function seedShowcaseCatalog(db: DatabaseSync) {
  if (process.env.NOVELREAD_SKIP_SEED === "1") return;
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM books").get() as { count: number } | undefined;
  if ((countRow?.count ?? 0) >= SHOWCASE_NOVELS.length) return;

  const salt = "0123456789abcdef0123456789abcdef";
  const pass = `${salt}:${passwordHash("novelread123", salt)}`;
  const authors = [
    { email: "linlada@novelread.local", name: "ลินลดา" },
    { email: "kirakorn@novelread.local", name: "คิรากร" },
    { email: "mekha@novelread.local", name: "เมฆาพเนจร" },
  ];
  const authorIds: number[] = [];
  for (const author of authors) {
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(author.email) as { id: number } | undefined;
    if (existing) {
      authorIds.push(Number(existing.id));
    } else {
      const res = db.prepare("INSERT INTO users(email, name, password) VALUES(?, ?, ?)").run(author.email, author.name, pass);
      authorIds.push(Number(res.lastInsertRowid));
    }
  }

  const baseTime = nowSeconds();
  SHOWCASE_NOVELS.forEach((item, index) => {
    const exists = db.prepare("SELECT id FROM books WHERE title = ?").get(item.title) as { id: number } | undefined;
    if (exists) return;
    const ownerId = authorIds[item.authorIdx] ?? authorIds[0];
    const penName = authors[item.authorIdx]?.name ?? "Novelread";
    const updated = baseTime - index * 3600;
    const bookRes = db
      .prepare("INSERT INTO books(owner, title, pen_name, summary, category, tags, cover, rating, status, updated) VALUES(?, ?, ?, ?, ?, ?, '', ?, ?, ?)")
      .run(ownerId, item.title, penName, item.summary, item.category, item.tags, item.rating, item.status, updated);
    const bookId = Number(bookRes.lastInsertRowid);
    item.chapters.forEach((ch, chIdx) => {
      db.prepare("INSERT INTO chapters(book_id, title, content, published, position, updated) VALUES(?, ?, ?, 1, ?, ?)")
        .run(bookId, ch.title, ch.content, chIdx + 1, updated + chIdx * 60);
    });
  });
}

function withDb<T>(fn: (db: DatabaseSync) => T): T {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  try {
    db.exec("PRAGMA foreign_keys=ON");
    db.exec(`
      CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS books(id INTEGER PRIMARY KEY,owner INTEGER REFERENCES users(id),title TEXT NOT NULL,pen_name TEXT NOT NULL,summary TEXT NOT NULL,category TEXT NOT NULL,tags TEXT NOT NULL,cover TEXT NOT NULL,rating TEXT NOT NULL,status TEXT NOT NULL,updated REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS chapters(id INTEGER PRIMARY KEY,book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,title TEXT NOT NULL,content TEXT NOT NULL,published INTEGER NOT NULL,position INTEGER NOT NULL,updated REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS shelf(user_id INTEGER REFERENCES users(id),book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,chapter_id INTEGER,progress REAL NOT NULL DEFAULT 0,followed INTEGER NOT NULL DEFAULT 0,updated REAL NOT NULL,PRIMARY KEY(user_id,book_id));
    `);
    const columns = db.prepare("PRAGMA table_info(shelf)").all() as Array<{ name: string }>;
    if (!columns.some(col => col.name === "anchor")) {
      db.exec("ALTER TABLE shelf ADD COLUMN anchor TEXT");
    }
    seedShowcaseCatalog(db);
    return fn(db);
  } finally {
    db.close();
  }
}

function nowSeconds() {
  return Date.now() / 1000;
}

function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function passwordHash(password: string, saltHex: string) {
  return pbkdf2Sync(password, Buffer.from(saltHex, "hex"), 260000, 32, "sha256").toString("hex");
}

function parseSessionToken(cookieHeader?: string | null): string {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === "novelread_session") {
      return decodeURIComponent(rest.join("="));
    }
  }
  return "";
}

type UserRecord = { id: number; email: string; name: string };

function getCurrentUser(db: DatabaseSync, cookieHeader?: string | null): UserRecord | null {
  const token = parseSessionToken(cookieHeader);
  if (!token) return null;
  const row = db
    .prepare("SELECT u.id, u.email, u.name FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token = ? AND s.expires > ?")
    .get(sha256Hex(token), nowSeconds()) as UserRecord | undefined;
  return row ? { id: Number(row.id), email: String(row.email), name: String(row.name) } : null;
}

function requireUser(db: DatabaseSync, cookieHeader?: string | null): UserRecord {
  const current = getCurrentUser(db, cookieHeader);
  if (!current) fail(401, "กรุณาเข้าสู่ระบบก่อน");
  return current;
}

function createSessionCookie(db: DatabaseSync, userId: number): string {
  const token = randomBytes(32).toString("base64url");
  const now = nowSeconds();
  const maxAge = 30 * 86400;
  db.prepare("DELETE FROM sessions WHERE expires < ?").run(now);
  db.prepare("INSERT INTO sessions(token, user_id, expires) VALUES(?, ?, ?)").run(sha256Hex(token), userId, now + maxAge);
  return `novelread_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}

function requireOwnedBook(db: DatabaseSync, bookId: number, current: UserRecord) {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(bookId) as Record<string, unknown> | undefined;
  if (!book) fail(404, "ไม่พบเรื่องนี้");
  if (Number(book.owner) !== current.id) fail(403, "แก้ไขได้เฉพาะผลงานของคุณ");
  return book;
}

type BookPayload = {
  title: string;
  pen_name: string;
  summary: string;
  category: string;
  tags: string;
  cover: string;
  rating: string;
  status: string;
};

function normalizeBookPayload(raw: Record<string, unknown>): BookPayload {
  const data: BookPayload = {
    title: String(raw.title ?? ""),
    pen_name: String(raw.pen_name ?? ""),
    summary: String(raw.summary ?? ""),
    category: String(raw.category ?? "แฟนตาซี"),
    tags: String(raw.tags ?? ""),
    cover: String(raw.cover ?? ""),
    rating: String(raw.rating ?? "ทั่วไป"),
    status: String(raw.status ?? "กำลังเขียน"),
  };
  if (!data.title.trim() || !data.pen_name.trim()) fail(400, "กรอกชื่อเรื่องและนามปากกา");
  if (!["ทั่วไป", "18+"].includes(data.rating) || !["กำลังเขียน", "จบแล้ว"].includes(data.status)) {
    fail(400, "สถานะหรือเรตไม่ถูกต้อง");
  }
  const uploaded = /^\/api\/library\/covers\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(data.cover);
  if (data.cover && !uploaded) {
    try {
      const parsed = new URL(data.cover);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        fail(400, "ลิงก์ปกต้องเป็น http หรือ https หรือปกที่อัปโหลด");
      }
    } catch {
      fail(400, "ลิงก์ปกต้องเป็น http หรือ https หรือปกที่อัปโหลด");
    }
  }
  return data;
}

function detectImageFormat(buffer: Buffer): { ext: "png" | "jpg" | "webp"; mediaType: string } | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: "png", mediaType: "image/png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: "jpg", mediaType: "image/jpeg" };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { ext: "webp", mediaType: "image/webp" };
  }
  return null;
}

export function listLocalNovels(filters: { q?: string; category?: string; status?: string; mine?: boolean }, cookieHeader?: string | null) {
  return withDb(db => {
    const current = getCurrentUser(db, cookieHeader);
    if (filters.mine && !current) fail(401, "กรุณาเข้าสู่ระบบก่อน");
    const rows = db
      .prepare("SELECT b.*, (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id AND c.published = 1) chapter_count FROM books b ORDER BY updated DESC")
      .all() as Array<Record<string, unknown>>;
    const qLower = (filters.q ?? "").trim().toLocaleLowerCase("th-TH");
    return rows.filter(b => {
      const visible = filters.mine ? Number(b.owner) === current?.id : Number(b.chapter_count) > 0;
      if (!visible) return false;
      if (qLower) {
        const hay = `${b.title ?? ""}${b.pen_name ?? ""}${b.tags ?? ""}`.toLocaleLowerCase("th-TH");
        if (!hay.includes(qLower)) return false;
      }
      if (filters.category && b.category !== filters.category) return false;
      if (filters.status && b.status !== filters.status) return false;
      return true;
    });
  });
}

export function getLocalNovel(bookId: number, cookieHeader?: string | null) {
  if (!Number.isFinite(bookId)) return null;
  return withDb(db => {
    const current = getCurrentUser(db, cookieHeader);
    const b = db.prepare("SELECT * FROM books WHERE id = ?").get(bookId) as Record<string, unknown> | undefined;
    if (!b) return null;
    const owner = Boolean(current && Number(b.owner) === current.id);
    const chapters = db
      .prepare("SELECT id, title, published, position, updated FROM chapters WHERE book_id = ? AND (published = 1 OR ? = 1) ORDER BY position, id")
      .all(bookId, owner ? 1 : 0) as Array<Record<string, unknown>>;
    if (!owner && chapters.length === 0) return null;
    return {
      ...b,
      is_owner: owner,
      chapters: chapters.map(c => ({ ...c, published: Boolean(c.published) })),
    };
  });
}

export function getLocalChapter(chapterId: number, cookieHeader?: string | null) {
  if (!Number.isFinite(chapterId)) return null;
  return withDb(db => {
    const current = getCurrentUser(db, cookieHeader);
    const c = db
      .prepare("SELECT c.*, b.owner, b.title book_title FROM chapters c JOIN books b ON b.id = c.book_id WHERE c.id = ?")
      .get(chapterId) as Record<string, unknown> | undefined;
    if (!c || (!c.published && (!current || Number(c.owner) !== current.id))) {
      return null;
    }
    return { ...c, published: Boolean(c.published) };
  });
}

export function getLocalAuthor(authorId: number, offset = 0, limit = 12, status = "") {
  if (!Number.isFinite(authorId)) return null;
  return withDb(db => {
    const author = db.prepare("SELECT id, name FROM users WHERE id = ?").get(authorId) as { id: number; name: string } | undefined;
    if (!author) return null;
    let where = "b.owner = ? AND EXISTS (SELECT 1 FROM chapters c WHERE c.book_id = b.id AND c.published = 1)";
    const args: Array<number | string> = [authorId];
    if (status) {
      where += " AND b.status = ?";
      args.push(status);
    }
    const totalRow = db.prepare(`SELECT COUNT(*) AS cnt FROM books b WHERE ${where}`).get(...args) as { cnt: number };
    const total = Number(totalRow?.cnt ?? 0);
    const rows = db
      .prepare(
        `SELECT b.*, (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id AND c.published = 1) chapter_count FROM books b WHERE ${where} ORDER BY b.updated DESC, b.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, limit, offset) as Array<Record<string, unknown>>;
    return {
      author: { id: Number(author.id), name: String(author.name) },
      books: rows,
      total,
      next_offset: offset + rows.length < total ? offset + rows.length : null,
    };
  });
}

export type LocalApiResult = {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
  rawBuffer?: Buffer;
};

export function handleLocalLibraryRequest(
  method: string,
  pathSegments: string[],
  searchParams: URLSearchParams,
  rawBody: ArrayBuffer | undefined,
  cookieHeader?: string | null,
): LocalApiResult {
  const parseJson = (): Record<string, unknown> => {
    if (!rawBody || rawBody.byteLength === 0) return {};
    try {
      return JSON.parse(Buffer.from(rawBody).toString("utf-8")) as Record<string, unknown>;
    } catch {
      fail(400, "รูปแบบข้อมูลไม่ถูกต้อง");
    }
  };

  try {
    const [seg0, seg1, seg2, seg3] = pathSegments;

    if (seg0 === "register" && method === "POST") {
      const body = parseJson();
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const name = String(body.name ?? "").trim();
      if (!email.includes("@") || !name) fail(400, "กรอกอีเมลและนามปากกาให้ครบ");
      if (password.length < 8) fail(400, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      const salt = randomBytes(16).toString("hex");
      return withDb(db => {
        let uid: number;
        try {
          const res = db
            .prepare("INSERT INTO users(email, name, password) VALUES(?, ?, ?)")
            .run(email, name, `${salt}:${passwordHash(password, salt)}`);
          uid = Number(res.lastInsertRowid);
        } catch {
          fail(409, "อีเมลนี้มีบัญชีแล้ว");
        }
        const setCookie = createSessionCookie(db, uid);
        return {
          status: 200,
          headers: { "set-cookie": setCookie },
          body: { id: uid, email, name },
        };
      });
    }

    if (seg0 === "login" && method === "POST") {
      const body = parseJson();
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      return withDb(db => {
        const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
          | { id: number; email: string; name: string; password: string }
          | undefined;
        const [salt, expected] = row ? String(row.password).split(":") : ["00".repeat(16), ""];
        const actualBuf = Buffer.from(passwordHash(password, salt), "utf-8");
        const expectedBuf = Buffer.from(expected || "", "utf-8");
        if (!row || actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
          fail(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        }
        const setCookie = createSessionCookie(db, Number(row.id));
        return {
          status: 200,
          headers: { "set-cookie": setCookie },
          body: { id: Number(row.id), email: String(row.email), name: String(row.name) },
        };
      });
    }

    if (seg0 === "me" && method === "GET") {
      return withDb(db => ({
        status: 200,
        body: getCurrentUser(db, cookieHeader),
      }));
    }

    if (seg0 === "logout" && method === "POST") {
      return withDb(db => {
        requireUser(db, cookieHeader);
        const token = parseSessionToken(cookieHeader);
        if (token) {
          db.prepare("DELETE FROM sessions WHERE token = ?").run(sha256Hex(token));
        }
        return {
          status: 200,
          headers: { "set-cookie": "novelread_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" },
          body: { ok: true },
        };
      });
    }

    if (seg0 === "profile" && method === "PUT") {
      const body = parseJson();
      const name = String(body.name ?? "").trim();
      if (!name) fail(400, "กรอกนามปากกา");
      return withDb(db => {
        const current = requireUser(db, cookieHeader);
        db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, current.id);
        return { status: 200, body: { ...current, name } };
      });
    }

    if (seg0 === "books" && !seg1 && method === "GET") {
      const rows = listLocalNovels(
        {
          q: searchParams.get("q") ?? "",
          category: searchParams.get("category") ?? "",
          status: searchParams.get("status") ?? "",
          mine: searchParams.get("mine") === "true",
        },
        cookieHeader,
      );
      return { status: 200, body: rows };
    }

    if (seg0 === "books" && !seg1 && method === "POST") {
      const data = normalizeBookPayload(parseJson());
      return withDb(db => {
        const current = requireUser(db, cookieHeader);
        const res = db
          .prepare(
            "INSERT INTO books(owner, title, pen_name, summary, category, tags, cover, rating, status, updated) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(current.id, data.title, data.pen_name, data.summary, data.category, data.tags, data.cover, data.rating, data.status, nowSeconds());
        return { status: 200, body: { id: Number(res.lastInsertRowid) } };
      });
    }

    if (seg0 === "books" && seg1 && !seg2 && method === "GET") {
      const bid = Number(seg1);
      const book = getLocalNovel(bid, cookieHeader);
      if (!book) fail(404, "ไม่พบเรื่องนี้");
      return { status: 200, body: book };
    }

    if (seg0 === "books" && seg1 && !seg2 && method === "PUT") {
      const bid = Number(seg1);
      const data = normalizeBookPayload(parseJson());
      return withDb(db => {
        const current = requireUser(db, cookieHeader);
        requireOwnedBook(db, bid, current);
        db.prepare(
          "UPDATE books SET title=?, pen_name=?, summary=?, category=?, tags=?, cover=?, rating=?, status=?, updated=? WHERE id=?",
        ).run(data.title, data.pen_name, data.summary, data.category, data.tags, data.cover, data.rating, data.status, nowSeconds(), bid);
        return { status: 200, body: { id: bid } };
      });
    }

    if (seg0 === "books" && seg1 && seg2 === "chapters" && (method === "POST" || method === "PUT")) {
      const bid = Number(seg1);
      const cid = seg3 ? Number(seg3) : null;
      const body = parseJson();
      const title = String(body.title ?? "");
      const content = String(body.content ?? "");
      const published = Boolean(body.published);
      if (!title.trim()) fail(400, "กรอกชื่อตอน");
      if (published && !content.trim()) fail(400, "เพิ่มเนื้อหาก่อนเผยแพร่");
      return withDb(db => {
        const current = requireUser(db, cookieHeader);
        requireOwnedBook(db, bid, current);
        const now = nowSeconds();
        let savedId = cid;
        if (cid !== null) {
          const found = db.prepare("SELECT id FROM chapters WHERE id = ? AND book_id = ?").get(cid, bid);
          if (!found) fail(404, "ไม่พบตอนนี้");
          db.prepare("UPDATE chapters SET title=?, content=?, published=?, updated=? WHERE id=?").run(
            title,
            content,
            published ? 1 : 0,
            now,
            cid,
          );
        } else {
          const posRow = db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM chapters WHERE book_id = ?").get(bid) as { pos: number };
          const res = db
            .prepare("INSERT INTO chapters(book_id, title, content, published, position, updated) VALUES(?, ?, ?, ?, ?, ?)")
            .run(bid, title, content, published ? 1 : 0, Number(posRow.pos), now);
          savedId = Number(res.lastInsertRowid);
        }
        db.prepare("UPDATE books SET updated = ? WHERE id = ?").run(now, bid);
        return { status: 200, body: { id: savedId } };
      });
    }

    if (seg0 === "books" && seg1 && seg2 === "order" && method === "PUT") {
      const bid = Number(seg1);
      const body = parseJson();
      const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
      return withDb(db => {
        const current = requireUser(db, cookieHeader);
        requireOwnedBook(db, bid, current);
        const actual = db.prepare("SELECT id FROM chapters WHERE book_id = ?").all(bid) as Array<{ id: number }>;
        const actualSet = new Set(actual.map(r => Number(r.id)));
        if (ids.length !== actualSet.size || new Set(ids).size !== actualSet.size || ids.some(id => !actualSet.has(id))) {
          fail(400, "รายการตอนต้องครบและไม่ซ้ำ");
        }
        const stmt = db.prepare("UPDATE chapters SET position = ? WHERE id = ?");
        ids.forEach((cid, idx) => stmt.run(idx + 1, cid));
        return { status: 200, body: { ok: true } };
      });
    }

    if (seg0 === "chapters" && seg1 && method === "GET") {
      const chapter = getLocalChapter(Number(seg1), cookieHeader);
      if (!chapter) fail(404, "ไม่พบตอนที่เผยแพร่");
      return { status: 200, body: chapter };
    }

    if (seg0 === "authors" && seg1 && method === "GET") {
      const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));
      const limit = Math.min(48, Math.max(1, Number(searchParams.get("limit") ?? 12)));
      const status = searchParams.get("status") ?? "";
      const authorPage = getLocalAuthor(Number(seg1), offset, limit, status);
      if (!authorPage) fail(404, "ไม่พบนักเขียน");
      return { status: 200, body: authorPage };
    }

    if (seg0 === "shelf" && !seg1 && method === "GET") {
      return withDb(db => {
        const current = requireUser(db, cookieHeader);
        const rows = db
          .prepare(
            "SELECT b.*, s.chapter_id, s.progress, s.followed, s.anchor, s.updated reading_updated FROM shelf s JOIN books b ON b.id = s.book_id WHERE s.user_id = ? ORDER BY s.updated DESC",
          )
          .all(current.id) as Array<Record<string, unknown>>;
        return {
          status: 200,
          body: rows.map(r => ({
            ...r,
            followed: Boolean(r.followed),
            anchor: typeof r.anchor === "string" && r.anchor ? JSON.parse(r.anchor) : null,
          })),
        };
      });
    }

    if (seg0 === "shelf" && seg1 && method === "PUT") {
      const bid = Number(seg1);
      const body = parseJson();
      const hasChapterId = body.chapter_id !== undefined && body.chapter_id !== null;
      const chapterId = hasChapterId ? Number(body.chapter_id) : null;
      const progress = typeof body.progress === "number" ? Math.max(0, Math.min(1, body.progress)) : 0;
      const hasFollowed = body.followed !== undefined && body.followed !== null;
      const anchorObj =
        body.anchor && typeof body.anchor === "object"
          ? {
              paragraph: Math.max(0, Number((body.anchor as Record<string, unknown>).paragraph ?? 0)),
              character: Math.max(0, Number((body.anchor as Record<string, unknown>).character ?? 0)),
            }
          : null;
      return withDb(db => {
        const current = requireUser(db, cookieHeader);
        const book = db
          .prepare("SELECT id FROM books WHERE id = ? AND (owner = ? OR EXISTS(SELECT 1 FROM chapters WHERE book_id = books.id AND published = 1))")
          .get(bid, current.id);
        if (!book) fail(404, "ไม่พบเรื่องที่เผยแพร่");
        if (chapterId !== null) {
          const ch = db.prepare("SELECT id FROM chapters WHERE id = ? AND book_id = ? AND published = 1").get(chapterId, bid);
          if (!ch) fail(400, "ตอนนี้ยังไม่เผยแพร่หรืออยู่คนละเรื่อง");
        }
        const old = db.prepare("SELECT * FROM shelf WHERE user_id = ? AND book_id = ?").get(current.id, bid) as
          | Record<string, unknown>
          | undefined;
        const nextChapter = chapterId !== null ? chapterId : old ? (old.chapter_id as number | null) : null;
        const nextProgress = chapterId !== null ? progress : old ? Number(old.progress ?? 0) : 0;
        const nextFollowed = hasFollowed ? (body.followed ? 1 : 0) : old ? Number(old.followed ?? 0) : 0;
        const nextAnchor = chapterId !== null ? (anchorObj ? JSON.stringify(anchorObj) : null) : old ? (old.anchor as string | null) : null;
        db.prepare(
          "INSERT INTO shelf(user_id, book_id, chapter_id, progress, followed, updated, anchor) VALUES(?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, book_id) DO UPDATE SET chapter_id=excluded.chapter_id, progress=excluded.progress, followed=excluded.followed, updated=excluded.updated, anchor=excluded.anchor",
        ).run(current.id, bid, nextChapter, nextProgress, nextFollowed, nowSeconds(), nextAnchor);
        return { status: 200, body: { ok: true } };
      });
    }

    if (seg0 === "covers" && !seg1 && method === "POST") {
      const body = parseJson();
      const base64Data = String(body.data ?? "");
      if (!base64Data) fail(400, "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาเลือกไฟล์ใหม่");
      let content: Buffer;
      try {
        content = Buffer.from(base64Data, "base64");
      } catch {
        fail(400, "ข้อมูลรูปภาพไม่ถูกต้อง กรุณาเลือกไฟล์ใหม่");
      }
      if (!content.length || content.length > 5 * 1024 * 1024) {
        fail(413, "ปกต้องมีขนาดไม่เกิน 5 MB");
      }
      const format = detectImageFormat(content);
      if (!format) {
        fail(400, "เลือกรูป PNG, JPEG หรือ WebP เท่านั้น");
      }
      return withDb(db => {
        requireUser(db, cookieHeader);
        mkdirSync(COVERS_DIR, { recursive: true });
        const name = `${sha256Hex(content)}.${format.ext}`;
        const target = join(COVERS_DIR, name);
        if (!existsSync(target)) {
          const temp = join(COVERS_DIR, `${randomBytes(16).toString("hex")}.tmp`);
          try {
            writeFileSync(temp, content);
            renameSync(temp, target);
          } finally {
            try {
              if (existsSync(temp)) unlinkSync(temp);
            } catch { /* ignore */ }
          }
        }
        return {
          status: 200,
          body: { url: `/api/library/covers/${name}`, media_type: format.mediaType },
        };
      });
    }

    if (seg0 === "covers" && seg1 && method === "GET") {
      if (!/^[a-f0-9]{64}\.(png|jpg|webp)$/.test(seg1)) {
        fail(404, "ไม่พบปกรูปนี้");
      }
      const filePath = join(COVERS_DIR, seg1);
      if (!existsSync(filePath)) {
        fail(404, "ไม่พบปกรูปนี้");
      }
      const ext = seg1.split(".").pop();
      const mediaType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      return {
        status: 200,
        headers: {
          "content-type": mediaType,
          "x-content-type-options": "nosniff",
          "cache-control": "public, max-age=31536000, immutable",
        },
        body: null,
        rawBuffer: readFileSync(filePath),
      };
    }

    fail(404, "ไม่พบเส้นทาง API ที่ร้องขอ");
  } catch (err) {
    if (err instanceof HttpError) {
      return { status: err.status, body: { detail: err.detail } };
    }
    return { status: 500, body: { detail: err instanceof Error ? err.message : "เกิดข้อผิดพลาดภายในระบบ" } };
  }
}
