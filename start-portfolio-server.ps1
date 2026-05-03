$ProjectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 4173

try {
  $client = New-Object System.Net.Sockets.TcpClient
  $connect = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
  if ($connect.AsyncWaitHandle.WaitOne(500, $false) -and $client.Connected) {
    $client.Close()
    exit 0
  }
  $client.Close()
} catch {
  if ($client) {
    $client.Close()
  }
}

Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $ProjectPath -WindowStyle Hidden
