$Package = "@delta-infra/cli"
$Mirrors = @(
    "https://registry.npmmirror.com"
    "https://registry.npmjs.org"
)

foreach ($Registry in $Mirrors) {
    Write-Host "[delta-cli] Trying npm registry: $Registry"
    npm install -g $Package --registry=$Registry
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[delta-cli] Installed successfully from $Registry"
        exit 0
    }
    Write-Host "[delta-cli] Failed, trying next..."
}

Write-Host "[delta-cli] All npm registries failed"
exit 1
