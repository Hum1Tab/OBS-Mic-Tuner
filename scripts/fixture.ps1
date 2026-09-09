Add-Type -AssemblyName System.Speech
$tunerOutput = Join-Path $PSScriptRoot '../test-output'
New-Item -ItemType Directory -Force -Path $tunerOutput | Out-Null
$tunerSynth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
  $tunerSynth.SelectVoice('Microsoft Zira Desktop')
  $tunerSynth.SetOutputToWaveFile((Join-Path $tunerOutput 'tts.wav'))
  $tunerSynth.Speak('Hello everyone. Today I am testing my microphone for a live stream. I want my voice to sound clear and natural. Thank you for listening. Let us enjoy the show together.')
} finally { $tunerSynth.Dispose() }
