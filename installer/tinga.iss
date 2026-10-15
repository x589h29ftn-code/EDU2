; De installer van Tinga voor Windows (Inno Setup 6). De workflow .github/workflows/windows.yml roept dit aan na het inpakken:
;
;   ISCC.exe /DVersie=1.0.0 installer\tinga.iss
;
; Wat hij doet: in het Nederlands, zonder beheerdersrechten (voor één gebruiker, in %LOCALAPPDATA%\Programs\Tinga; wie wil kan
; kiezen voor iedereen), een snelkoppeling in het Startmenu en desgewenst op het bureaublad, een verwijderprogramma in
; Windows-instellingen, en na afloop het spel starten. De beelden en het icoon maakt installer/beelden.py in dist/installer.
; De opgeslagen spellen staan in de gegevens van de app (%APPDATA%\Tinga) en blijven bij verwijderen staan.

#ifndef Versie
  #define Versie "1.0.0"
#endif
#define Naam "Tinga"
#define Exe "Tinga.exe"
#define Bron "..\dist\Tinga-win32-x64"
#define Beelden "..\dist\installer"

[Setup]
; vaste id: zo herkent een nieuwere installer de vorige en werkt hij hem bij in plaats van ernaast te zetten
AppId={{6B2E9C41-7A3D-4C1E-9F6B-2D8A5E7C3B10}
AppName={#Naam}
AppVersion={#Versie}
AppVerName=GTA VI: Tinga {#Versie}
AppPublisher=Tinga Sneek
VersionInfoDescription=GTA VI: Tinga, een spel in de wijk Tinga in Sneek
DefaultDirName={autopf}\{#Naam}
DefaultGroupName={#Naam}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist\installer
OutputBaseFilename=Tinga-Setup-{#Versie}
SetupIconFile={#Beelden}\tinga.ico
UninstallDisplayIcon={app}\{#Exe}
UninstallDisplayName=GTA VI: Tinga
WizardStyle=modern
WizardImageFile={#Beelden}\wizard_100.bmp,{#Beelden}\wizard_150.bmp,{#Beelden}\wizard_200.bmp,{#Beelden}\wizard_250.bmp
WizardSmallImageFile={#Beelden}\klein_100.bmp,{#Beelden}\klein_150.bmp,{#Beelden}\klein_200.bmp,{#Beelden}\klein_250.bmp
; de mp3's zijn al gecomprimeerd; lzma2 haalt de rest (de javascript, de kaart) flink omlaag
Compression=lzma2/max
SolidCompression=yes
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "nl"; MessagesFile: "compiler:Languages\Dutch.isl"

[Messages]
nl.WelcomeLabel1=Welkom bij GTA VI: Tinga
nl.WelcomeLabel2=Tinga is al jarenlang in de greep van drugskartels. Erik en Mark werken zich omhoog bij De Veteraan.%n%nDeze wizard zet het spel op je computer. Sluit eerst andere programma's af.

[Tasks]
Name: "bureaublad"; Description: "Een snelkoppeling op het bureaublad"; GroupDescription: "Snelkoppelingen:"

[Files]
Source: "{#Bron}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\GTA VI - Tinga"; Filename: "{app}\{#Exe}"
Name: "{group}\Tinga verwijderen"; Filename: "{uninstallexe}"
Name: "{autodesktop}\GTA VI - Tinga"; Filename: "{app}\{#Exe}"; Tasks: bureaublad

[Run]
Filename: "{app}\{#Exe}"; Description: "GTA VI: Tinga nu spelen"; Flags: nowait postinstall skipifsilent
