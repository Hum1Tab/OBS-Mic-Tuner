Add-Type -AssemblyName System.Drawing
$tunerAssets = Join-Path $PSScriptRoot '../assets'
New-Item -ItemType Directory -Force -Path $tunerAssets | Out-Null
$tunerBitmap = [System.Drawing.Bitmap]::new(256,256)
$tunerGraphics = [System.Drawing.Graphics]::FromImage($tunerBitmap)
$tunerGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$tunerGraphics.Clear([System.Drawing.Color]::FromArgb(35,52,73))
$tunerBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(149,205,219))
try {
  $tunerGraphics.FillEllipse($tunerBrush,16,16,224,224)
  $tunerInk = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(35,52,73),14)
  $tunerInk.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $tunerInk.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  try {
    $tunerHeights = @(32,70,114,70,32)
    for ($i=0;$i -lt 5;$i++) { $x = 68 + $i*30; $height = $tunerHeights[$i]; $tunerGraphics.DrawLine($tunerInk,$x,(128-$height/2),$x,(128+$height/2)) }
  } finally { $tunerInk.Dispose() }
  $tunerBitmap.Save((Join-Path $tunerAssets 'icon.png'),[System.Drawing.Imaging.ImageFormat]::Png)
  $tunerPng = [System.IO.File]::ReadAllBytes((Join-Path $tunerAssets 'icon.png'))
  $tunerFile = [System.IO.File]::Create((Join-Path $tunerAssets 'icon.ico'))
  $tunerWriter = [System.IO.BinaryWriter]::new($tunerFile)
  try {
    $tunerWriter.Write([uint16]0); $tunerWriter.Write([uint16]1); $tunerWriter.Write([uint16]1)
    $tunerWriter.Write([byte]0); $tunerWriter.Write([byte]0); $tunerWriter.Write([byte]0); $tunerWriter.Write([byte]0)
    $tunerWriter.Write([uint16]1); $tunerWriter.Write([uint16]32); $tunerWriter.Write([uint32]$tunerPng.Length); $tunerWriter.Write([uint32]22); $tunerWriter.Write($tunerPng)
  } finally { $tunerWriter.Dispose() }
} finally { $tunerBrush.Dispose(); $tunerGraphics.Dispose(); $tunerBitmap.Dispose() }

