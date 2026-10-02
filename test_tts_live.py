"""Live network smoke: run against an explicitly network-enabled local server.
Never substitute mocks for this check. Prints cache hits separately.
"""
import os,time,httpx
TEXT='ราตรีนั้นเงียบผิดปกติ เขาหยุดเท้าลงกลางทางเดินหิน มือขวากุมด้ามดาบไว้แน่น'
BASE=os.getenv('NOVELREAD_TEST_URL','http://127.0.0.1:8758')
with httpx.Client(timeout=30) as c:
 for voice in ('th-TH-PremwadeeNeural','th-TH-NiwatNeural'):
  text=TEXT+' การทดสอบใหม่ '+str(time.time_ns())
  body={'text':text,'engine':'edge','voice':voice}
  first=c.post(BASE+'/api/tts',json=body)
  print(voice,first.status_code,first.headers.get('x-cache'),len(first.content),flush=True)
  assert first.status_code==200,first.text
  assert first.headers.get('x-cache')=='miss','fresh synthesis required'
  assert first.content.startswith(b'ID3') or first.content[0]==255
  again=c.post(BASE+'/api/tts',json=body)
  assert again.headers.get('x-cache')=='hit' and again.content==first.content
  print('cache repeat hit and identical',flush=True)
