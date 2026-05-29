param(
  [switch]$CheckOnly,
  [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$distro = "Ubuntu-22.04"
$linuxNodeBin = "/root/.nvm/versions/node/v24.14.1/bin"
$linuxPath = "${linuxNodeBin}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
$wslBuildDir = "/root/DJun-cf-build"

function Convert-ToWslPath([string]$WindowsPath) {
  $full = (Resolve-Path $WindowsPath).Path
  if ($full.Length -gt 2 -and $full[1] -eq ":" -and ($full[2] -eq "\" -or $full[2] -eq "/")) {
    $drive = $full[0].ToString().ToLowerInvariant()
    $rest = $full.Substring(3) -replace "\\", "/"
    return "/mnt/$drive/$rest"
  }

  $converted = (& wsl.exe -d $distro -- wslpath -a $full).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $converted) {
    throw "Failed to convert path for WSL: $full"
  }
  return $converted
}

function Quote-Bash([string]$Value) {
  return "'" + $Value.Replace("'", "'\''") + "'"
}

function Invoke-WslBash([string]$Script) {
  & wsl.exe -d $distro -- bash -lc $Script
  if ($LASTEXITCODE -ne 0) {
    throw "WSL command failed with exit code $LASTEXITCODE"
  }
}

function Invoke-Native([string]$Label, [scriptblock]$Command) {
  Write-Host ""
  Write-Host "==> $Label"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

Set-Location $repo
$repoWsl = Convert-ToWslPath $repo

Write-Host "[DJun] Repository: $repo"
Write-Host "[DJun] WSL repository path: $repoWsl"

Invoke-Native "Check WSL Node" {
  Invoke-WslBash "export PATH=$(Quote-Bash $linuxPath); node -v; npm -v"
}

Invoke-Native "Check Windows Wrangler login" {
  & npx.cmd wrangler whoami
}

if ($CheckOnly) {
  Write-Host "[DJun] Check completed."
  exit 0
}

$buildScript = @'
set -euo pipefail
export PATH="__LINUX_PATH__"
rm -rf __BUILD_DIR_QUOTED__
mkdir -p __BUILD_DIR_QUOTED__
cd __REPO_WSL__
tar \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.open-next' \
  --exclude='./.git' \
  --exclude='./data/*.sqlite' \
  --exclude='./data/*.sqlite-*' \
  -cf - . | tar -xf - -C __BUILD_DIR_QUOTED__
cd __BUILD_DIR_QUOTED__
npm ci --no-audit --progress=false
npm run cloudflare:build
'@

$buildScript = $buildScript.Replace("__LINUX_PATH__", $linuxPath)
$buildScript = $buildScript.Replace("__REPO_WSL__", (Quote-Bash $repoWsl))
$buildScript = $buildScript.Replace("__BUILD_DIR_QUOTED__", (Quote-Bash $wslBuildDir))

Invoke-Native "Build OpenNext bundle in WSL" {
  Invoke-WslBash $buildScript
}

$openNextPath = Join-Path $repo ".open-next"
if (Test-Path $openNextPath) {
  $resolvedOpenNext = (Resolve-Path $openNextPath).Path
  if (-not $resolvedOpenNext.StartsWith($repo, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove outside repository: $resolvedOpenNext"
  }
  Remove-Item -LiteralPath $resolvedOpenNext -Recurse -Force
}

$slash = [string][char]92
$wslOpenNext = $slash + $slash + "wsl.localhost" + $slash + $distro + $slash + "root" + $slash + "DJun-cf-build" + $slash + ".open-next"
Copy-Item -LiteralPath $wslOpenNext -Destination $openNextPath -Recurse -Force

if (-not (Test-Path (Join-Path $openNextPath "worker.js"))) {
  throw "OpenNext worker.js was not copied to $openNextPath"
}

if ($BuildOnly) {
  Write-Host "[DJun] Build completed. Skipping deploy because -BuildOnly was provided."
  exit 0
}

Invoke-Native "Deploy to Cloudflare Workers" {
  & npx.cmd wrangler deploy --config (Join-Path $repo "wrangler.jsonc")
}

Write-Host ""
Write-Host "[DJun] Deployed to https://djun.3439394104.workers.dev"
