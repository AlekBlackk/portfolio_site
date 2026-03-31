$ErrorActionPreference = 'Stop'

$htmlPath = Join-Path $PSScriptRoot '..\index.html'
$html = Get-Content -Path $htmlPath -Raw

$cardMatches = [regex]::Matches($html, '<a[^>]*class="card"[^>]*style="([^"]*)"')

if ($cardMatches.Count -eq 0) {
  throw 'No project cards with inline styles were found.'
}

foreach ($match in $cardMatches) {
  $styleValue = $match.Groups[1].Value

  if ($styleValue -match 'transition-delay\s*:') {
    throw "Project card inline styles must not use transition-delay: '$styleValue'"
  }
}

Write-Host 'Project cards do not use transition-delay in inline styles.'
