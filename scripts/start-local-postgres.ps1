$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$postgresControl = Join-Path $projectRoot '.tools/pgsql/bin/pg_ctl.exe'
$postgresData = Join-Path $projectRoot '.local/pgdata'
$postgresLog = Join-Path $projectRoot '.local/postgres.log'
if (-not (Test-Path -LiteralPath $postgresControl) -or -not (Test-Path -LiteralPath $postgresData)) {
    throw 'Portable PostgreSQL was not initialized. Use Docker Compose or a native PostgreSQL install; see README.md.'
}
& $postgresControl -D $postgresData status
if ($LASTEXITCODE -ne 0) {
    & $postgresControl -D $postgresData -l $postgresLog -o '-h 127.0.0.1 -p 5433' -w start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL startup failed.' }
}
