$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$work = Join-Path $root 'dist\voice-work'
New-Item -ItemType Directory -Path $work -Force | Out-Null
Add-Type -AssemblyName System.Speech
$voice = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$format = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(24000, 16, 1)
try {
    $voice.SelectVoice('Microsoft Zira Desktop')
    $voice.Rate = -1
    $index = 0
    $timeline = Get-Content -Raw -Encoding utf8 (Join-Path $root 'src\intro-cues.json') | ConvertFrom-Json
    foreach ($cue in $timeline.cues) {
        if (-not $cue.spoken) { continue }
        $text = if ($cue.synthesis) { $cue.synthesis } else { $cue.spoken }
        $voice.SetOutputToWaveFile((Join-Path $work "$index.wav"), $format)
        $voice.Speak($text)
        $voice.SetOutputToNull()
        $index++
    }
} finally {
    $voice.Dispose()
}
python (Join-Path $PSScriptRoot 'mix-intro.py')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
