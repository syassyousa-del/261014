Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptPath = WScript.ScriptFullName
scriptFolder = fso.GetParentFolderName(scriptPath)
WshShell.CurrentDirectory = scriptFolder

electronPath = scriptFolder & "\node_modules\electron\dist\electron.exe"
sQuote = Chr(34)

If Not fso.FileExists(electronPath) Then
    electronPath = scriptFolder & "\node_modules\.bin\electron.cmd"
    If Not fso.FileExists(electronPath) Then
        MsgBox "Electron executable not found. Run npm install.", 16, "Launch Error"
        WScript.Quit 1
    End If
End If

commandLine = sQuote & electronPath & sQuote & " ."
WshShell.Run commandLine, 1, False
