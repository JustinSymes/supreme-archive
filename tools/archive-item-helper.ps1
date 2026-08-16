param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('FetchText', 'BgStatus', 'DiscoverSanity', 'BrowserText', 'InspectItem', 'VerifyFiles', 'RenameFiles', 'Download', 'RemoveBackground', 'RemoveBackgroundBatch', 'CopyTsv', 'Publish', 'Cleanup')]
    [string]$Action,
    [string]$Url,
    [string]$OutputPath,
    [string]$InputPath,
    [string]$RowFile,
    [string[]]$Files,
    [string]$Message
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$scratchRoot = 'D:\SupArcFiles'
$browserHeaders = @{
    'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    'Accept-Language' = 'en-US,en;q=0.9'
}

function Resolve-AllowedPath([string]$Path) {
    $resolved = [System.IO.Path]::GetFullPath($Path)
    if (-not ($resolved.StartsWith($repoRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or
              $resolved.StartsWith($scratchRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase))) {
        throw "Path is outside the archive workspace and scratch folder: $resolved"
    }
    return $resolved
}

switch ($Action) {
    'InspectItem' {
        if (-not $InputPath) { throw 'InputPath is required.' }
        $source = Resolve-AllowedPath $InputPath
        $html = Get-Content -LiteralPath $source -Raw -Encoding utf8
        $gallery = [regex]::Match($html, '<div class="style-thumbnails">([\s\S]*?)</div>', 'IgnoreCase').Groups[1].Value
        $thumbs = [regex]::Matches($gallery, 'data-zoom-src="([^"]+)"', 'IgnoreCase') | ForEach-Object { $_.Groups[1].Value }
        $titles = [regex]::Matches($html, '<h1[^>]*>(.*?)</h1>', 'IgnoreCase') | ForEach-Object {
            [Net.WebUtility]::HtmlDecode(($_.Groups[1].Value -replace '<[^>]+>', '').Trim())
        } | Sort-Object -Unique
        $prices = [regex]::Matches($html, '\$[0-9]+(?:\.[0-9]{2})?') | ForEach-Object { $_.Value } |
            Group-Object | Sort-Object Count -Descending | Select-Object -First 5 Name, Count
        'TITLE:'
        $titles
        'IMAGES:'
        for ($index = 0; $index -lt $thumbs.Count; $index++) {
            "{0}`t{1}" -f ($index + 1), $thumbs[$index]
        }
        'PRICES:'
        $prices | Format-Table -AutoSize | Out-String
    }
    'VerifyFiles' {
        if (-not $Files) { throw 'Files is required.' }
        foreach ($file in ($Files -split ',')) {
            $resolved = Resolve-AllowedPath $file
            if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
                throw "Missing file: $resolved"
            }
            Get-Item -LiteralPath $resolved | Select-Object FullName, Length
        }
    }
    'RenameFiles' {
        if (-not $InputPath -or -not $OutputPath) { throw 'InputPath and OutputPath are required.' }
        $sources = $InputPath -split ','
        $targets = $OutputPath -split ','
        if ($sources.Count -ne $targets.Count) { throw 'InputPath and OutputPath must contain the same number of comma-separated paths.' }
        for ($index = 0; $index -lt $sources.Count; $index++) {
            $source = Resolve-AllowedPath $sources[$index]
            $target = Resolve-AllowedPath $targets[$index]
            if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing source file: $source" }
            if (Test-Path -LiteralPath $target) { throw "Target already exists: $target" }
            Move-Item -LiteralPath $source -Destination $target
            Get-Item -LiteralPath $target | Select-Object FullName, Length
        }
    }
    'BgStatus' {
        if (-not $Url) { throw 'Pass the task ID in Url.' }
        $statusBody = @{ type = 4; codes = @($Url) } | ConvertTo-Json -Compress
        Invoke-RestMethod -Method Post -Uri 'https://bgeraser.com/api/bgeraser/legacy/status' `
            -ContentType 'application/json' -Headers @{
                Origin = 'https://bgeraser.com'; Referer = 'https://bgeraser.com/'; 'User-Agent' = $browserHeaders['User-Agent']
            } -Body $statusBody | ConvertTo-Json -Depth 8
    }
    'FetchText' {
        if (-not $Url) { throw 'Url is required.' }
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -Headers $browserHeaders
        $response.Content
    }
    'DiscoverSanity' {
        if (-not $Url) { throw 'Url is required.' }
        $page = (Invoke-WebRequest -UseBasicParsing -Uri $Url -Headers $browserHeaders).Content
        $origin = ([uri]$Url).GetLeftPart([System.UriPartial]::Authority)
        $scripts = [regex]::Matches($page, '<script[^>]+src="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
        foreach ($script in $scripts) {
            $scriptUrl = if ($script.StartsWith('http')) { $script } else { $origin + $script }
            $source = (Invoke-WebRequest -UseBasicParsing -Uri $scriptUrl -Headers $browserHeaders).Content
            [regex]::Matches($source, '.{0,100}(?:projectId|SANITY_DATASET|dataset:|cdn\.sanity\.io/images).{0,160}') | ForEach-Object { $_.Value }
        }
    }
    'BrowserText' {
        if (-not $Url) { throw 'Url is required.' }
        $edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
        $profile = Join-Path $scratchRoot 'archive_item_edge_profile'
        $port = 9222
        $edgeProcess = Start-Process -FilePath $edge -WindowStyle Hidden -PassThru -ArgumentList @(
            "--remote-debugging-port=$port", "--user-data-dir=$profile", '--no-first-run', '--disable-default-apps', $Url
        )
        try {
            $tabs = $null
            for ($attempt = 0; $attempt -lt 30; $attempt++) {
                Start-Sleep -Seconds 1
                try { $tabs = Invoke-RestMethod "http://127.0.0.1:$port/json" } catch { continue }
                if ($tabs) { break }
            }
            $tab = @($tabs | Where-Object { $_.type -eq 'page' -and $_.url -like '*supremecommunity.com*' })[0]
            if (-not $tab) { throw 'Could not find the requested browser tab.' }
            Start-Sleep -Seconds 12
            $socket = [System.Net.WebSockets.ClientWebSocket]::new()
            $socket.ConnectAsync([uri]$tab.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
            $request = @{ id = 1; method = 'Runtime.evaluate'; params = @{ expression = 'document.documentElement.outerHTML'; returnByValue = $true } } | ConvertTo-Json -Depth 5 -Compress
            $bytes = [Text.Encoding]::UTF8.GetBytes($request)
            $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
            $buffer = New-Object byte[] 10485760
            $segment = [ArraySegment[byte]]::new($buffer)
            $stream = [IO.MemoryStream]::new()
            do {
                $received = $socket.ReceiveAsync($segment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
                $stream.Write($buffer, 0, $received.Count)
            } until ($received.EndOfMessage)
            $response = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
            $html = $response.result.result.value
            if ($OutputPath) {
                $target = Resolve-AllowedPath $OutputPath
                [IO.File]::WriteAllText($target, $html, [Text.UTF8Encoding]::new($false))
                Get-Item -LiteralPath $target | Select-Object FullName, Length
            } else {
                $html
            }
            $socket.Dispose()
        } finally {
            Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like '*archive_item_edge_profile*' } | ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }
        }
    }
    'Download' {
        if (-not $Url -or -not $OutputPath) { throw 'Url and OutputPath are required.' }
        $target = Resolve-AllowedPath $OutputPath
        Invoke-WebRequest -UseBasicParsing -Uri $Url -Headers $browserHeaders -OutFile $target
        Get-Item -LiteralPath $target | Select-Object FullName, Length
    }
    'RemoveBackground' {
        if (-not $InputPath -or -not $OutputPath) { throw 'InputPath and OutputPath are required.' }
        $source = Resolve-AllowedPath $InputPath
        $target = Resolve-AllowedPath $OutputPath
        $uploadJson = & curl.exe -sS -X POST 'https://bgeraser.com/api/bgeraser/legacy/upload' `
            -H 'Origin: https://bgeraser.com' -H 'Referer: https://bgeraser.com/' `
            -H "User-Agent: $($browserHeaders['User-Agent'])" `
            -F "file=@$source" -F 'type=4' -F 'mattValue=0'
        if ($LASTEXITCODE -ne 0) { throw 'BG Eraser upload request failed.' }
        $upload = $uploadJson | ConvertFrom-Json
        $taskId = $upload.taskId
        if (-not $taskId) { throw 'BG Eraser did not return a task ID.' }
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            Start-Sleep -Seconds 2
            $statusBody = @{ type = 4; codes = @($taskId) } | ConvertTo-Json -Compress
            $status = Invoke-RestMethod -Method Post -Uri 'https://bgeraser.com/api/bgeraser/legacy/status' `
                -ContentType 'application/json' -Headers @{
                    Origin = 'https://bgeraser.com'; Referer = 'https://bgeraser.com/'; 'User-Agent' = $browserHeaders['User-Agent']
                } -Body $statusBody
            $result = if ($status.data) { @($status.data)[0] } else { $status }
            $downloadUrl = $null
            if ($result.downloadUrls) {
                if ($result.downloadUrls -is [string]) { $downloadUrl = $result.downloadUrls }
                elseif ($result.downloadUrls.PSObject.Properties[$taskId]) { $downloadUrl = $result.downloadUrls.PSObject.Properties[$taskId].Value }
                else { $downloadUrl = @($result.downloadUrls)[0] }
            }
            if ($result.status -eq 'success' -and $downloadUrl) {
                Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -Headers $browserHeaders -OutFile $target
                Get-Item -LiteralPath $target | Select-Object FullName, Length
                return
            }
            if ($result.status -eq 'failed') { throw "BG Eraser failed task $taskId." }
        }
        throw "Timed out waiting for BG Eraser task $taskId."
    }
    'RemoveBackgroundBatch' {
        if (-not $InputPath -or -not $OutputPath) { throw 'InputPath and OutputPath are required.' }
        $sources = @($InputPath -split ',' | ForEach-Object { Resolve-AllowedPath $_ })
        $targets = @($OutputPath -split ',' | ForEach-Object { Resolve-AllowedPath $_ })
        if ($sources.Count -ne $targets.Count) { throw 'InputPath and OutputPath must contain the same number of comma-separated paths.' }

        $jobs = @()
        for ($index = 0; $index -lt $sources.Count; $index++) {
            $uploadJson = & curl.exe -sS -X POST 'https://bgeraser.com/api/bgeraser/legacy/upload' `
                -H 'Origin: https://bgeraser.com' -H 'Referer: https://bgeraser.com/' `
                -H "User-Agent: $($browserHeaders['User-Agent'])" `
                -F "file=@$($sources[$index])" -F 'type=4' -F 'mattValue=0'
            if ($LASTEXITCODE -ne 0) { throw "BG Eraser upload failed: $($sources[$index])" }
            $upload = $uploadJson | ConvertFrom-Json
            if (-not $upload.taskId) { throw "BG Eraser did not return a task ID: $($sources[$index])" }
            $jobs += [pscustomobject]@{ TaskId = [string]$upload.taskId; Target = $targets[$index]; Complete = $false }
        }

        for ($attempt = 0; $attempt -lt 90; $attempt++) {
            $pending = @($jobs | Where-Object { -not $_.Complete })
            if ($pending.Count -eq 0) {
                $jobs | ForEach-Object { Get-Item -LiteralPath $_.Target | Select-Object FullName, Length }
                return
            }
            $statusBody = @{ type = 4; codes = @($pending.TaskId) } | ConvertTo-Json -Compress
            try {
                $status = Invoke-RestMethod -Method Post -Uri 'https://bgeraser.com/api/bgeraser/legacy/status' `
                    -ContentType 'application/json' -Headers @{
                        Origin = 'https://bgeraser.com'; Referer = 'https://bgeraser.com/'; 'User-Agent' = $browserHeaders['User-Agent']
                    } -Body $statusBody
            } catch {
                $responseCode = [int]$_.Exception.Response.StatusCode
                if ($responseCode -in @(429, 500, 502, 503, 504)) {
                    Start-Sleep -Seconds ([Math]::Min(10, 2 + $attempt))
                    continue
                }
                throw
            }

            $containers = if ($status.data) { @($status.data) } else { @($status) }
            foreach ($job in $pending) {
                $downloadUrl = $null
                foreach ($container in $containers) {
                    if ($container.downloadUrls -is [string] -and $pending.Count -eq 1) {
                        $downloadUrl = $container.downloadUrls
                    } elseif ($container.downloadUrls -and $container.downloadUrls.PSObject.Properties[$job.TaskId]) {
                        $downloadUrl = $container.downloadUrls.PSObject.Properties[$job.TaskId].Value
                    } elseif (($container.code -eq $job.TaskId -or $container.taskId -eq $job.TaskId) -and $container.downloadUrl) {
                        $downloadUrl = $container.downloadUrl
                    }
                    if ($downloadUrl) { break }
                }
                if ($downloadUrl) {
                    Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -Headers $browserHeaders -OutFile $job.Target
                    $job.Complete = $true
                }
            }
            Start-Sleep -Seconds 2
        }
        $unfinished = ($jobs | Where-Object { -not $_.Complete } | ForEach-Object { $_.TaskId }) -join ', '
        throw "Timed out waiting for BG Eraser tasks: $unfinished"
    }
    'CopyTsv' {
        if (-not $RowFile) { throw 'RowFile is required.' }
        $source = Resolve-AllowedPath $RowFile
        $rows = Get-Content -LiteralPath $source -Raw -Encoding utf8
        Set-Clipboard -Value $rows.TrimEnd("`r", "`n")
        'TSV copied to clipboard.'
    }
    'Publish' {
        if (-not $Files -or -not $Message) { throw 'Files and Message are required.' }
        Push-Location $repoRoot
        try {
            foreach ($file in ($Files -split ',')) {
                $resolved = Resolve-AllowedPath (Join-Path $repoRoot $file)
                git add -- $resolved
            }
            git commit -m $Message
            git push origin main
        } finally {
            Pop-Location
        }
    }
    'Cleanup' {
        foreach ($file in ($Files -split ',')) {
            $resolved = Resolve-AllowedPath $file
            if (Test-Path -LiteralPath $resolved -PathType Leaf) {
                Remove-Item -LiteralPath $resolved -Force
            } elseif ($resolved.StartsWith($scratchRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -and
                      (Test-Path -LiteralPath $resolved -PathType Container)) {
                Remove-Item -LiteralPath $resolved -Recurse -Force
            }
        }
    }
}
