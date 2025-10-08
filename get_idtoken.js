var f=new ActiveXObject("Scripting.FileSystemObject");
var t=f.OpenTextFile("idtoken.json",1), s=t.ReadAll(); t.Close();
var m=/"idToken"\s*:\s*"([^"]+)"/.exec(s);
if(m){WScript.Echo(m[1]);}else{WScript.Quit(1);}
