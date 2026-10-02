import asyncio, unittest
from unittest.mock import patch
from edge_tts.exceptions import NoAudioReceived
from lib.tts import edge
class EdgeRecovery(unittest.IsolatedAsyncioTestCase):
 async def test_transient_retries_fresh_communicator(self):
  calls=[]
  class Communicate:
   def __init__(self,*a,**kw):calls.append(1)
   async def stream(self):
    if len(calls)==1:raise NoAudioReceived('no audio')
    yield {'type':'audio','data':b'valid-audio'}
  with patch.object(edge.edge_tts,'Communicate',Communicate):
   self.assertEqual(await edge.synth('ไทย','th-TH-PremwadeeNeural'),b'valid-audio')
  self.assertEqual(len(calls),2)
 async def test_persistent_failure_bounded(self):
  calls=[]
  class Communicate:
   def __init__(self,*a,**kw):calls.append(1)
   async def stream(self):
    raise NoAudioReceived('no audio')
    yield
  with patch.object(edge.edge_tts,'Communicate',Communicate):
   with self.assertRaises(RuntimeError):await edge.synth('ไทย','th-TH-PremwadeeNeural')
  self.assertEqual(len(calls),2)
 async def test_invalid_parameters_not_retried(self):
  with patch.object(edge.edge_tts,'Communicate',side_effect=ValueError('invalid')) as factory:
   with self.assertRaises(ValueError):await edge.synth('ไทย','bad')
   self.assertEqual(factory.call_count,1)
class ApiFailure(unittest.IsolatedAsyncioTestCase):
 async def test_empty_and_failure_never_cached(self):
  import tempfile
  from pathlib import Path
  from unittest.mock import AsyncMock
  from fastapi import HTTPException
  import server
  for effect in (RuntimeError('private upstream detail'), None):
   with tempfile.TemporaryDirectory() as folder:
    synthesizer=AsyncMock(side_effect=effect,return_value=b'')
    with patch.object(server,'CACHE_AUDIO',Path(folder)),patch.object(server.tts_engines,'synth',synthesizer):
     with self.assertRaises(HTTPException) as caught:await server.api_tts(server.TtsRequest(text='ไทย'))
     self.assertEqual(caught.exception.status_code,502)
     self.assertNotIn('private upstream',caught.exception.detail)
     self.assertEqual(list(Path(folder).iterdir()),[])
if __name__=='__main__':unittest.main()

