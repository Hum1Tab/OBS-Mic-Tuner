"""Offline differential test against the installed OBS DLL. No microphone, UI,
scenes, or user configuration is opened. The OBS binary is never distributed."""
import ctypes as c
import os, json, pathlib, time, array, math

root = pathlib.Path(__file__).resolve().parents[1]
out = root / 'test-output' / 'native'
installed = pathlib.Path(os.environ.get('OBS_TEST_ROOT', r'C:\Program Files\obs-studio'))
handle = os.add_dll_directory(str(installed / 'bin' / '64bit'))
obs = c.CDLL(str(installed / 'bin' / '64bit' / 'obs.dll'))
P = c.c_void_p
def bind(name, result, *args):
    f = getattr(obs,name); f.restype=result; f.argtypes=list(args); return f
class AudioInfo(c.Structure):
    _fields_=[('rate',c.c_uint32),('speakers',c.c_int)]
class AudioData(c.Structure):
    _fields_=[('data',P*8),('frames',c.c_uint32),('timestamp',c.c_uint64)]
class SourceAudio(c.Structure):
    _fields_=[('data',P*8),('frames',c.c_uint32),('speakers',c.c_int),('format',c.c_int),('rate',c.c_uint32),('timestamp',c.c_uint64)]
class SourceInfo(c.Structure):
    _fields_=[('id',c.c_char_p),('type',c.c_int),('flags',c.c_uint32),('get_name',P),('create',P),('destroy',P),('width',P),('height',P)]
LOG=c.CFUNCTYPE(None,c.c_int,c.c_char_p,P,P)
@LOG
def quiet_log(level, message, args, param): pass
bind('base_set_log_handler',None,LOG,P)(quiet_log,None)
startup=bind('obs_startup',c.c_bool,c.c_char_p,c.c_char_p,P)
assert startup(b'en-US',str(out / 'config').encode(),None)
try:
    version=bind('obs_get_version_string',c.c_char_p)().decode()
    assert version=='32.2.2', f'Expected OBS 32.2.2, got {version}'
    assert bind('obs_reset_audio',c.c_bool,c.POINTER(AudioInfo))(c.byref(AudioInfo(48000,1)))
    module=P()
    assert bind('obs_open_module',c.c_int,c.POINTER(P),c.c_char_p,c.c_char_p)(c.byref(module),str(installed/'obs-plugins'/'64bit'/'obs-filters.dll').encode(),str(installed/'data'/'obs-plugins'/'obs-filters').encode())==0
    assert bind('obs_init_module',c.c_bool,P)(module)
    label=c.create_string_buffer(b'Mic Tuner Offline Test')
    NAME=c.CFUNCTYPE(P,P); CREATE=c.CFUNCTYPE(P,P,P); DESTROY=c.CFUNCTYPE(None,P)
    name=NAME(lambda _:c.addressof(label)); create=CREATE(lambda settings,source:source); destroy=DESTROY(lambda _:None)
    info=SourceInfo(b'mic_tuner_test_input',0,2,c.cast(name,P),c.cast(create,P),c.cast(destroy,P),None,None)
    bind('obs_register_source_s',None,c.POINTER(SourceInfo),c.c_size_t)(c.byref(info),c.sizeof(info))
    make=bind('obs_source_create_private',P,c.c_char_p,c.c_char_p,P)
    release=bind('obs_source_release',None,P)
    output=bind('obs_source_output_audio',None,P,c.POINTER(SourceAudio))
    capture_type=c.CFUNCTYPE(None,P,P,c.POINTER(AudioData),c.c_bool)
    input_bytes=(out/'input.f32').read_bytes(); results=[]
    for case in json.loads((out/'cases.json').read_text()):
        source=make(b'mic_tuner_test_input',case['name'].encode(),None); assert source
        received=[]; filters=[]
        @capture_type
        def capture(param,src,audio,muted):
            a=audio.contents; received.append(c.string_at(a.data[0],a.frames*4))
        bind('obs_source_add_audio_capture_callback',None,P,capture_type,P)(source,capture,None)
        try:
            for f in case['filters']:
                data=bind('obs_data_create_from_json',P,c.c_char_p)(json.dumps(f['settings']).encode())
                filter_source=make(f['id'].encode(),f['id'].encode(),data)
                bind('obs_data_release',None,P)(data); assert filter_source
                bind('obs_source_filter_add',None,P,P)(source,filter_source); filters.append(filter_source)
            timestamp=time.monotonic_ns()
            for start in range(0,len(input_bytes),480*4):
                block=c.create_string_buffer(input_bytes[start:start+480*4])
                audio=SourceAudio((P*8)(c.addressof(block)),len(block.raw[:-1])//4,1,8,48000,timestamp+(start//4)*1_000_000_000//48000)
                output(source,c.byref(audio))
            actual=b''.join(received); (out/f"{case['name']}-actual.f32").write_bytes(actual)
            assert len(actual)==len(input_bytes), (case['name'],len(actual),len(input_bytes))
            a=array.array('f'); a.frombytes(actual)
            e=array.array('f'); e.frombytes((out/f"{case['name']}-expected.f32").read_bytes())
            error=max(abs(x-y) for x,y in zip(a,e))
            rms=math.sqrt(sum((x-y)**2 for x,y in zip(a,e))/len(a))
            results.append(dict(case=case['name'],max_abs_error=error,rms_error=rms,passed=error<0.0002))
        finally:
            bind('obs_source_remove_audio_capture_callback',None,P,capture_type,P)(source,capture,None)
            release(source)
            for f in filters: release(f)
    summary=dict(obs=version,rate=48000,channels=1,results=results)
    (out/'comparison.json').write_text(json.dumps(summary,indent=2))
    print(json.dumps(summary,indent=2))
    assert all(r['passed'] for r in results)
finally:
    bind('obs_shutdown',None)()
