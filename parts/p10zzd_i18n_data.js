/* ---------- interface translations (3.3) ----------
   One row per English text: en|th|fr|es|pt|de|ja|zh|ko (order of I18N_LANGS in p10zze_i18n). The English text is the
   text shown in the interface without its leading emoji / symbols and trailing "…" (i18nSplit keeps those).
   To add a text: add a row with all 9 columns (the unit test checks every row). Untranslated texts stay in English. */
const I18N_ROWS = `Menu|เมนู|Menu|Menú|Menu|Menü|メニュー|菜单|메뉴
File|ไฟล์|Fichier|Archivo|Arquivo|Datei|ファイル|文件|파일
Start screen|หน้าเริ่มต้น|Écran d'accueil|Pantalla de inicio|Tela inicial|Startbildschirm|スタート画面|开始界面|시작 화면
New|ใหม่|Nouveau|Nuevo|Novo|Neu|新規|新建|새로 만들기
New manga page|หน้ามังงะใหม่|Nouvelle page de manga|Nueva página de manga|Nova página de mangá|Neue Manga-Seite|新規マンガページ|新建漫画页|새 만화 페이지
Open|เปิด|Ouvrir|Abrir|Abrir|Öffnen|開く|打开|열기
Save|บันทึก|Enregistrer|Guardar|Salvar|Speichern|保存|保存|저장
Import image|นำเข้ารูปภาพ|Importer une image|Importar imagen|Importar imagem|Bild importieren|画像を読み込む|导入图像|이미지 가져오기
Import pictures as animation frames|นำเข้ารูปเป็นเฟรมแอนิเมชัน|Importer des images comme images d'animation|Importar imágenes como fotogramas|Importar imagens como quadros de animação|Bilder als Animationsframes importieren|画像をアニメのフレームとして読み込む|将图片导入为动画帧|이미지를 애니메이션 프레임으로 가져오기
Import sound / music|นำเข้าเสียง / เพลง|Importer un son / une musique|Importar sonido / música|Importar som / música|Ton / Musik importieren|音声 / 音楽を読み込む|导入声音 / 音乐|소리 / 음악 가져오기
Import video|นำเข้าวิดีโอ|Importer une vidéo|Importar vídeo|Importar vídeo|Video importieren|動画を読み込む|导入视频|동영상 가져오기
Save to cloud|บันทึกขึ้นคลาวด์|Enregistrer dans le cloud|Guardar en la nube|Salvar na nuvem|In der Cloud speichern|クラウドに保存|保存到云端|클라우드에 저장
Open from cloud|เปิดจากคลาวด์|Ouvrir depuis le cloud|Abrir desde la nube|Abrir da nuvem|Aus der Cloud öffnen|クラウドから開く|从云端打开|클라우드에서 열기
Auto-save (on / off)|บันทึกอัตโนมัติ (เปิด / ปิด)|Enregistrement auto (oui / non)|Guardado automático (sí / no)|Salvamento automático (liga / desliga)|Automatisch speichern (an / aus)|自動保存（オン / オフ）|自动保存（开 / 关）|자동 저장 (켜기 / 끄기)
Auto-save settings|ตั้งค่าบันทึกอัตโนมัติ|Réglages de l'enregistrement auto|Ajustes de guardado automático|Configurações do salvamento automático|Einstellungen für automatisches Speichern|自動保存の設定|自动保存设置|자동 저장 설정
Close document|ปิดเอกสาร|Fermer le document|Cerrar documento|Fechar documento|Dokument schließen|書類を閉じる|关闭文档|문서 닫기
Rename|เปลี่ยนชื่อ|Renommer|Renombrar|Renomear|Umbenennen|名前を変更|重命名|이름 바꾸기
Export animation|ส่งออกแอนิเมชัน|Exporter l'animation|Exportar animación|Exportar animação|Animation exportieren|アニメーションを書き出す|导出动画|애니메이션 내보내기
Export current frame (PNG)|ส่งออกเฟรมนี้ (PNG)|Exporter l'image actuelle (PNG)|Exportar fotograma actual (PNG)|Exportar quadro atual (PNG)|Aktuelles Bild exportieren (PNG)|現在のフレームを書き出す（PNG）|导出当前帧（PNG）|현재 프레임 내보내기 (PNG)
Save as Photoshop PSD|บันทึกเป็น Photoshop PSD|Enregistrer en PSD Photoshop|Guardar como PSD de Photoshop|Salvar como PSD do Photoshop|Als Photoshop-PSD speichern|Photoshop PSD で保存|另存为 Photoshop PSD|Photoshop PSD로 저장
Page manager|จัดการหน้า|Gestion des pages|Gestor de páginas|Gerenciador de páginas|Seitenverwaltung|ページ管理|页面管理|페이지 관리
Reopen my last work at start (on / off)|เปิดงานล่าสุดเมื่อเริ่ม (เปิด / ปิด)|Rouvrir mon dernier travail au démarrage (oui / non)|Reabrir mi último trabajo al iniciar (sí / no)|Reabrir meu último trabalho ao iniciar (liga / desliga)|Letzte Arbeit beim Start öffnen (an / aus)|起動時に前回の作業を開く（オン / オフ）|启动时打开上次的作品（开 / 关）|시작할 때 마지막 작업 열기 (켜기 / 끄기)
Start fresh (close everything)|เริ่มใหม่ (ปิดทั้งหมด)|Repartir de zéro (tout fermer)|Empezar de cero (cerrar todo)|Começar do zero (fechar tudo)|Neu beginnen (alles schließen)|最初から（すべて閉じる）|重新开始（全部关闭）|새로 시작 (모두 닫기)
Time-lapse|ไทม์แลปส์|Time-lapse|Time-lapse|Time-lapse|Zeitraffer|タイムラプス|延时录制|타임랩스
Time-lapse recording on / off|บันทึกไทม์แลปส์ เปิด / ปิด|Enregistrement time-lapse oui / non|Grabación time-lapse sí / no|Gravação time-lapse liga / desliga|Zeitraffer-Aufnahme an / aus|タイムラプス録画 オン / オフ|延时录制 开 / 关|타임랩스 녹화 켜기 / 끄기
Edit|แก้ไข|Édition|Editar|Editar|Bearbeiten|編集|编辑|편집
Undo|เลิกทำ|Annuler|Deshacer|Desfazer|Rückgängig|元に戻す|撤销|실행 취소
Redo|ทำซ้ำ|Rétablir|Rehacer|Refazer|Wiederholen|やり直し|重做|다시 실행
Cut|ตัด|Couper|Cortar|Recortar|Ausschneiden|切り取り|剪切|잘라내기
Copy|คัดลอก|Copier|Copiar|Copiar|Kopieren|コピー|复制|복사
Paste|วาง|Coller|Pegar|Colar|Einfügen|貼り付け|粘贴|붙여넣기
Paste image from clipboard|วางรูปจากคลิปบอร์ด|Coller l'image du presse-papiers|Pegar imagen del portapapeles|Colar imagem da área de transferência|Bild aus Zwischenablage einfügen|クリップボードの画像を貼り付け|从剪贴板粘贴图像|클립보드 이미지 붙여넣기
Fill selection|เติมสีส่วนที่เลือก|Remplir la sélection|Rellenar selección|Preencher seleção|Auswahl füllen|選択範囲を塗りつぶす|填充选区|선택 영역 채우기
Clear selection|ล้างส่วนที่เลือก|Effacer la sélection|Borrar selección|Limpar seleção|Auswahl löschen|選択範囲を消去|清除选区|선택 영역 지우기
Swap colours|สลับสี|Inverser les couleurs principale / secondaire|Intercambiar colores|Trocar cores|Farben tauschen|色を入れ替え|交换颜色|색 바꾸기
Reset colours|รีเซ็ตสี|Couleurs par défaut|Restablecer colores|Redefinir cores|Farben zurücksetzen|色をリセット|重置颜色|색 초기화
Convert brightness to opacity|แปลงความสว่างเป็นความทึบ|Convertir la luminosité en opacité|Convertir brillo en opacidad|Converter brilho em opacidade|Helligkeit in Deckkraft umwandeln|輝度を透明度に変換|将亮度转换为不透明度|밝기를 불투명도로 변환
Brightness / Contrast|ความสว่าง / คอนทราสต์|Luminosité / Contraste|Brillo / Contraste|Brilho / Contraste|Helligkeit / Kontrast|明るさ / コントラスト|亮度 / 对比度|밝기 / 대비
Hue / Saturation / Luminosity|ฮิว / ความอิ่มตัว / ความสว่าง|Teinte / Saturation / Luminosité|Tono / Saturación / Luminosidad|Matiz / Saturação / Luminosidade|Farbton / Sättigung / Helligkeit|色相 / 彩度 / 明度|色相 / 饱和度 / 明度|색조 / 채도 / 명도
Level correction|ปรับระดับสี|Correction des niveaux|Corrección de niveles|Correção de níveis|Tonwertkorrektur|レベル補正|色阶校正|레벨 보정
Posterization|โปสเตอร์ไรซ์|Postérisation|Posterización|Posterização|Tontrennung|ポスタリゼーション|色调分离|포스터화
Binarization|ขาวดำสองระดับ|Binarisation|Binarización|Binarização|Schwellenwert|2値化|二值化|이진화
Reverse gradient (invert)|กลับสี|Inverser (négatif)|Invertir|Inverter|Umkehren (Negativ)|階調の反転|反转渐变（反相）|계조 반전
Auto-flat colours (one colour per area)|ลงสีพื้นอัตโนมัติ (หนึ่งสีต่อพื้นที่)|Aplats automatiques (une couleur par zone)|Colores planos automáticos (un color por zona)|Cores chapadas automáticas (uma cor por área)|Automatische Grundfarben (eine Farbe pro Fläche)|自動下塗り（領域ごとに1色）|自动平涂（每个区域一种颜色）|자동 밑색 (영역마다 한 색)
Auto-flat colours|ลงสีพื้นอัตโนมัติ|Aplats automatiques|Colores planos automáticos|Cores chapadas automáticas|Automatische Grundfarben|自動下塗り|自动平涂|자동 밑색
Reset Inkvessa to defaults|รีเซ็ต Inkvessa เป็นค่าเริ่มต้น|Réinitialiser Inkvessa|Restablecer Inkvessa|Redefinir o Inkvessa|Inkvessa zurücksetzen|Inkvessa を初期設定に戻す|将 Inkvessa 恢复默认|Inkvessa 기본값으로 초기화
Select|เลือก|Sélection|Selección|Seleção|Auswahl|選択範囲|选择|선택
All|ทั้งหมด|Tout|Todo|Tudo|Alles|すべて|全部|전체
Deselect|ยกเลิกการเลือก|Désélectionner|Deseleccionar|Desmarcar|Auswahl aufheben|選択を解除|取消选择|선택 해제
Invert|กลับส่วนที่เลือก|Inverser|Invertir|Inverter|Umkehren|反転|反选|반전
Expand selected area|ขยายส่วนที่เลือก|Agrandir la sélection|Expandir selección|Expandir seleção|Auswahl erweitern|選択範囲を拡張|扩展选区|선택 영역 확장
Shrink selected area|หดส่วนที่เลือก|Réduire la sélection|Contraer selección|Contrair seleção|Auswahl verkleinern|選択範囲を縮小|收缩选区|선택 영역 축소
Blur border|เบลอขอบ|Adoucir le bord|Desenfocar borde|Suavizar borda|Rand weichzeichnen|境界をぼかす|模糊边缘|경계 흐리기
Layer|เลเยอร์|Calque|Capa|Camada|Ebene|レイヤー|图层|레이어
Layers|เลเยอร์|Calques|Capas|Camadas|Ebenen|レイヤー一覧|图层列表|레이어 목록
Brush: tools and their settings|พู่กัน: เครื่องมือและการตั้งค่า|Pinceau : outils et réglages|Pincel: herramientas y ajustes|Pincel: ferramentas e ajustes|Pinsel: Werkzeuge und Einstellungen|ブラシ：ツールと設定|画笔：工具与设置|붓: 도구와 설정
Brush size|ขนาดพู่กัน|Taille du pinceau|Tamaño del pincel|Tamanho do pincel|Pinselgröße|ブラシサイズ|画笔大小|붓 크기
Brush opacity|ความทึบพู่กัน|Opacité du pinceau|Opacidad del pincel|Opacidade do pincel|Pinseldeckkraft|ブラシの不透明度|画笔不透明度|붓 불투명도
New layer|เลเยอร์ใหม่|Nouveau calque|Nueva capa|Nova camada|Neue Ebene|新規レイヤー|新建图层|새 레이어
New vector layer|เลเยอร์เวกเตอร์ใหม่|Nouveau calque vectoriel|Nueva capa vectorial|Nova camada vetorial|Neue Vektorebene|新規ベクターレイヤー|新建矢量图层|새 벡터 레이어
Duplicate|ทำสำเนา|Dupliquer|Duplicar|Duplicar|Duplizieren|複製|复制|복제
Merge down|รวมลงล่าง|Fusionner vers le bas|Combinar hacia abajo|Mesclar para baixo|Nach unten zusammenführen|下のレイヤーに結合|向下合并|아래로 병합
Delete|ลบ|Supprimer|Eliminar|Excluir|Löschen|削除|删除|삭제
New folder from ticked / this layer|โฟลเดอร์ใหม่จากที่ติ๊ก / เลเยอร์นี้|Nouveau dossier (calques cochés / ce calque)|Nueva carpeta (capas marcadas / esta capa)|Nova pasta (camadas marcadas / esta camada)|Neuer Ordner (markierte / diese Ebene)|チェックした / このレイヤーから新規フォルダー|用勾选的 / 此图层新建文件夹|체크한 / 이 레이어로 새 폴더
Colour label|ป้ายสี|Étiquette de couleur|Etiqueta de color|Etiqueta de cor|Farbmarkierung|カラーラベル|颜色标签|색상 라벨
Tick all layers|ติ๊กทุกเลเยอร์|Cocher tous les calques|Marcar todas las capas|Marcar todas as camadas|Alle Ebenen markieren|すべてのレイヤーにチェック|勾选所有图层|모든 레이어 체크
Untick all layers|เลิกติ๊กทุกเลเยอร์|Décocher tous les calques|Desmarcar todas las capas|Desmarcar todas as camadas|Alle Markierungen aufheben|すべてのチェックを外す|取消勾选所有图层|모든 체크 해제
Clip to layer below|ตัดตามเลเยอร์ด้านล่าง|Masque d'écrêtage sur le calque du dessous|Recortar con la capa inferior|Recortar na camada de baixo|An darunterliegender Ebene schneiden|下のレイヤーでクリッピング|剪贴到下方图层|아래 레이어에 클리핑
Lock transparent pixels|ล็อกพิกเซลโปร่งใส|Verrouiller la transparence|Bloquear píxeles transparentes|Bloquear pixels transparentes|Transparente Pixel sperren|透明ピクセルをロック|锁定透明像素|투명 픽셀 잠금
Lock layer|ล็อกเลเยอร์|Verrouiller le calque|Bloquear capa|Bloquear camada|Ebene sperren|レイヤーをロック|锁定图层|레이어 잠금
Set as reference layer|ตั้งเป็นเลเยอร์อ้างอิง|Définir comme calque de référence|Usar como capa de referencia|Definir como camada de referência|Als Referenzebene festlegen|参照レイヤーに設定|设为参考图层|참조 레이어로 설정
Set as draft layer|ตั้งเป็นเลเยอร์ร่าง|Définir comme calque brouillon|Usar como capa de borrador|Definir como camada de rascunho|Als Entwurfsebene festlegen|下描きレイヤーに設定|设为草稿图层|밑그림 레이어로 설정
Add 3D model (male / female)|เพิ่มโมเดล 3D (ชาย / หญิง)|Ajouter un modèle 3D (homme / femme)|Añadir modelo 3D (hombre / mujer)|Adicionar modelo 3D (homem / mulher)|3D-Modell hinzufügen (Mann / Frau)|3Dモデルを追加（男性 / 女性）|添加 3D 模型（男 / 女）|3D 모델 추가 (남성 / 여성)
Add video reference|เพิ่มวิดีโออ้างอิง|Ajouter une vidéo de référence|Añadir vídeo de referencia|Adicionar vídeo de referência|Referenzvideo hinzufügen|参考動画を追加|添加参考视频|참고 동영상 추가
Add sound / voice|เพิ่มเสียง / เสียงพูด|Ajouter un son / une voix|Añadir sonido / voz|Adicionar som / voz|Ton / Stimme hinzufügen|音声 / ボイスを追加|添加声音 / 语音|소리 / 음성 추가
Move up|เลื่อนขึ้น|Monter|Subir|Mover para cima|Nach oben|上へ移動|上移|위로 이동
Move down|เลื่อนลง|Descendre|Bajar|Mover para baixo|Nach unten|下へ移動|下移|아래로 이동
Clear this frame|ล้างเฟรมนี้|Effacer cette image|Borrar este fotograma|Limpar este quadro|Dieses Bild leeren|このフレームを消去|清除此帧|이 프레임 지우기
Bake transform|ฝังการแปลงรูป|Appliquer la transformation|Aplicar transformación|Aplicar transformação|Transformation anwenden|変形を確定|应用变换|변형 적용
Add layer mask|เพิ่มมาสก์เลเยอร์|Ajouter un masque de calque|Añadir máscara de capa|Adicionar máscara de camada|Ebenenmaske hinzufügen|レイヤーマスクを追加|添加图层蒙版|레이어 마스크 추가
Mask: hide outside selection|มาสก์: ซ่อนนอกส่วนที่เลือก|Masque : cacher hors de la sélection|Máscara: ocultar fuera de la selección|Máscara: ocultar fora da seleção|Maske: außerhalb der Auswahl ausblenden|マスク：選択範囲外を隠す|蒙版：隐藏选区外|마스크: 선택 영역 밖 숨기기
Mask: hide selection|มาสก์: ซ่อนส่วนที่เลือก|Masque : cacher la sélection|Máscara: ocultar la selección|Máscara: ocultar a seleção|Maske: Auswahl ausblenden|マスク：選択範囲を隠す|蒙版：隐藏选区|마스크: 선택 영역 숨기기
Edit mask / edit layer|แก้ไขมาสก์ / แก้ไขเลเยอร์|Modifier le masque / le calque|Editar máscara / capa|Editar máscara / camada|Maske / Ebene bearbeiten|マスクを編集 / レイヤーを編集|编辑蒙版 / 编辑图层|마스크 편집 / 레이어 편집
Invert mask|กลับมาสก์|Inverser le masque|Invertir máscara|Inverter máscara|Maske umkehren|マスクを反転|反转蒙版|마스크 반전
Apply mask to layer|ใช้มาสก์กับเลเยอร์|Appliquer le masque au calque|Aplicar máscara a la capa|Aplicar máscara à camada|Maske auf Ebene anwenden|マスクをレイヤーに適用|将蒙版应用到图层|마스크를 레이어에 적용
Delete mask|ลบมาสก์|Supprimer le masque|Eliminar máscara|Excluir máscara|Maske löschen|マスクを削除|删除蒙版|마스크 삭제
Bone tool: link parts by clicking|เครื่องมือกระดูก: คลิกเพื่อเชื่อมชิ้นส่วน|Outil os : relier les parties d'un clic|Herramienta hueso: unir partes con clics|Ferramenta osso: ligar partes clicando|Knochen-Werkzeug: Teile per Klick verbinden|ボーンツール：クリックでパーツをつなぐ|骨骼工具：点击连接部件|뼈 도구: 클릭으로 부위 연결
Bone tool: pose|เครื่องมือกระดูก: จัดท่า|Outil os : poser|Herramienta hueso: posar|Ferramenta osso: posar|Knochen-Werkzeug: posieren|ボーンツール：ポーズ|骨骼工具：摆姿势|뼈 도구: 포즈
Bone rig: set parent|ริกกระดูก: ตั้งตัวแม่|Squelette : choisir le parent|Esqueleto: elegir padre|Esqueleto: definir pai|Knochen-Rig: Elternteil festlegen|ボーンリグ：親を設定|骨骼绑定：设置父级|뼈 리그: 부모 설정
Bone rig: free this layer|ริกกระดูก: ปลดเลเยอร์นี้|Squelette : libérer ce calque|Esqueleto: liberar esta capa|Esqueleto: liberar esta camada|Knochen-Rig: diese Ebene lösen|ボーンリグ：このレイヤーを解除|骨骼绑定：释放此图层|뼈 리그: 이 레이어 해제
How to rig a character|วิธีริกตัวละคร|Comment animer un personnage avec des os|Cómo montar un esqueleto|Como montar o esqueleto de um personagem|So riggst du eine Figur|キャラクターのリグの作り方|如何绑定角色|캐릭터 리깅 방법
Paper colour & texture|สีและเนื้อกระดาษ|Couleur et texture du papier|Color y textura del papel|Cor e textura do papel|Papierfarbe und -struktur|用紙の色と質感|纸张颜色和纹理|종이 색과 질감
Manga|มังงะ|Manga|Manga|Mangá|Manga|マンガ|漫画|만화
Panel layout|การจัดช่อง|Disposition des cases|Diseño de viñetas|Layout de quadros|Panel-Layout|コマ割り|分格布局|칸 나누기
Focus lines|เส้นโฟกัส|Lignes de concentration|Líneas de enfoque|Linhas de foco|Konzentrationslinien|集中線|集中线|집중선
Speed lines|เส้นความเร็ว|Lignes de vitesse|Líneas de velocidad|Linhas de velocidade|Speedlines|流線|速度线|속도선
Screen tone|สกรีนโทน|Trame|Trama|Retícula|Rasterfolie|スクリーントーン|网点|스크린톤
Clear rulers|ล้างไม้บรรทัด|Effacer les règles|Borrar reglas|Limpar réguas|Lineale löschen|定規を消去|清除尺规|자 지우기
Show / hide rulers|แสดง / ซ่อนไม้บรรทัด|Afficher / masquer les règles|Mostrar / ocultar reglas|Mostrar / ocultar réguas|Lineale ein- / ausblenden|定規の表示 / 非表示|显示 / 隐藏尺规|자 보이기 / 숨기기
Ruler snapping on / off|ยึดตามไม้บรรทัด เปิด / ปิด|Aimantation aux règles oui / non|Ajuste a reglas sí / no|Ajuste às réguas liga / desliga|Am Lineal ausrichten an / aus|定規にスナップ オン / オフ|吸附尺规 开 / 关|자에 맞추기 켜기 / 끄기
Animation|แอนิเมชัน|Animation|Animación|Animação|Animation|アニメーション|动画|애니메이션
Play / pause|เล่น / หยุด|Lecture / pause|Reproducir / pausa|Reproduzir / pausar|Abspielen / Pause|再生 / 一時停止|播放 / 暂停|재생 / 일시 정지
Insert keyframe|แทรกคีย์เฟรม|Insérer une image clé|Insertar fotograma clave|Inserir quadro-chave|Schlüsselbild einfügen|キーフレームを挿入|插入关键帧|키프레임 삽입
Insert blank keyframe|แทรกคีย์เฟรมว่าง|Insérer une image clé vide|Insertar fotograma clave vacío|Inserir quadro-chave vazio|Leeres Schlüsselbild einfügen|空のキーフレームを挿入|插入空白关键帧|빈 키프레임 삽입
Insert frame|แทรกเฟรม|Insérer une image|Insertar fotograma|Inserir quadro|Bild einfügen|フレームを挿入|插入帧|프레임 삽입
Remove frame|ลบเฟรม|Retirer une image|Quitar fotograma|Remover quadro|Bild entfernen|フレームを削除|删除帧|프레임 제거
Remove keyframe|ลบคีย์เฟรม|Retirer l'image clé|Quitar fotograma clave|Remover quadro-chave|Schlüsselbild entfernen|キーフレームを削除|删除关键帧|키프레임 제거
Create motion tween|สร้างโมชันทวีน|Créer une interpolation de mouvement|Crear interpolación de movimiento|Criar interpolação de movimento|Bewegungs-Tween erstellen|モーショントゥイーンを作成|创建补间动画|모션 트윈 만들기
Remove tween|ลบทวีน|Retirer l'interpolation|Quitar interpolación|Remover interpolação|Tween entfernen|トゥイーンを削除|删除补间|트윈 제거
Toggle onion skin|เปิด / ปิดออเนียนสกิน|Pelure d'oignon oui / non|Papel cebolla sí / no|Papel cebola liga / desliga|Zwiebelhaut an / aus|オニオンスキン切り替え|切换洋葱皮|어니언 스킨 켜기 / 끄기
Duplicate frame|ทำสำเนาเฟรม|Dupliquer l'image|Duplicar fotograma|Duplicar quadro|Bild duplizieren|フレームを複製|复制帧|프레임 복제
Copy frame|คัดลอกเฟรม|Copier l'image|Copiar fotograma|Copiar quadro|Bild kopieren|フレームをコピー|复制帧|프레임 복사
Paste frame|วางเฟรม|Coller l'image|Pegar fotograma|Colar quadro|Bild einfügen|フレームを貼り付け|粘贴帧|프레임 붙여넣기
Copy drawing (this layer)|คัดลอกภาพวาด (เลเยอร์นี้)|Copier le dessin (ce calque)|Copiar dibujo (esta capa)|Copiar desenho (esta camada)|Zeichnung kopieren (diese Ebene)|絵をコピー（このレイヤー）|复制画面（此图层）|그림 복사 (이 레이어)
Paste drawing here (this layer)|วางภาพวาดที่นี่ (เลเยอร์นี้)|Coller le dessin ici (ce calque)|Pegar dibujo aquí (esta capa)|Colar desenho aqui (esta camada)|Zeichnung hier einfügen (diese Ebene)|ここに絵を貼り付け（このレイヤー）|在此粘贴画面（此图层）|여기에 그림 붙여넣기 (이 레이어)
Repeat frames (cycle)|ทำซ้ำเฟรม (วนลูป)|Répéter des images (cycle)|Repetir fotogramas (ciclo)|Repetir quadros (ciclo)|Bilder wiederholen (Zyklus)|フレームを繰り返す（サイクル）|重复帧（循环）|프레임 반복 (사이클)
Drawing library|คลังภาพวาด|Bibliothèque de dessins|Biblioteca de dibujos|Biblioteca de desenhos|Zeichnungsbibliothek|絵のライブラリ|画面库|그림 라이브러리
Reverse frames|กลับลำดับเฟรม|Inverser les images|Invertir fotogramas|Inverter quadros|Bilder umkehren|フレームを逆順に|反转帧顺序|프레임 역순
Shoot on 2s / 3s|ถ่ายทีละ 2 / 3 เฟรม|Animer en 2 / en 3|Animar a 2s / 3s|Animar em 2s / 3s|Auf Zweier / Dreier|2コマ / 3コマ打ち|一拍二 / 一拍三|2프레임 / 3프레임씩
Light table: pin / unpin this frame|โต๊ะไฟ: ปัก / ถอนเฟรมนี้|Table lumineuse : épingler / retirer cette image|Mesa de luz: fijar / quitar este fotograma|Mesa de luz: fixar / soltar este quadro|Leuchttisch: dieses Bild anheften / lösen|ライトテーブル：このフレームを固定 / 解除|透写台：固定 / 取消此帧|라이트 테이블: 이 프레임 고정 / 해제
Light table: clear|โต๊ะไฟ: ล้าง|Table lumineuse : vider|Mesa de luz: vaciar|Mesa de luz: limpar|Leuchttisch: leeren|ライトテーブル：クリア|透写台：清空|라이트 테이블: 비우기
Import video reference|นำเข้าวิดีโออ้างอิง|Importer une vidéo de référence|Importar vídeo de referencia|Importar vídeo de referência|Referenzvideo importieren|参考動画を読み込む|导入参考视频|참고 동영상 가져오기
Import audio|นำเข้าเสียง|Importer un son|Importar audio|Importar áudio|Audio importieren|音声を読み込む|导入音频|오디오 가져오기
Remove audio|ลบเสียง|Retirer le son|Quitar audio|Remover áudio|Audio entfernen|音声を削除|移除音频|오디오 제거
Lip-sync from sound|ลิปซิงก์จากเสียง|Synchro labiale depuis le son|Sincronía labial desde el sonido|Sincronia labial a partir do som|Lippensynchron aus Ton|音声から口パク|根据声音口型同步|소리로 립싱크
Video reference settings|ตั้งค่าวิดีโออ้างอิง|Réglages de la vidéo de référence|Ajustes del vídeo de referencia|Configurações do vídeo de referência|Einstellungen Referenzvideo|参考動画の設定|参考视频设置|참고 동영상 설정
Relink video|เชื่อมวิดีโอใหม่|Relier la vidéo|Volver a vincular vídeo|Revincular vídeo|Video neu verknüpfen|動画を再リンク|重新链接视频|동영상 다시 연결
Puppet: create in-betweens|หุ่นเชิด: สร้างภาพกลาง|Marionnette : créer les intervalles|Marioneta: crear intermedios|Marionete: criar intermediários|Puppe: Zwischenbilder erstellen|パペット：中割りを作成|木偶：生成中间帧|퍼핏: 중간 프레임 만들기
Puppet: remove pins|หุ่นเชิด: ถอนหมุด|Marionnette : retirer les épingles|Marioneta: quitar alfileres|Marionete: remover pinos|Puppe: Pins entfernen|パペット：ピンを削除|木偶：移除图钉|퍼핏: 핀 제거
Practice: rig the fox|ฝึก: ริกสุนัขจิ้งจอก|Exercice : animer le renard|Práctica: esqueleto del zorro|Prática: esqueleto da raposa|Übung: den Fuchs riggen|練習：キツネのリグ|练习：绑定狐狸|연습: 여우 리깅
New drawing on next frame|ภาพวาดใหม่ที่เฟรมถัดไป|Nouveau dessin à l'image suivante|Nuevo dibujo en el siguiente fotograma|Novo desenho no próximo quadro|Neue Zeichnung im nächsten Bild|次のフレームに新しい絵|在下一帧新建画面|다음 프레임에 새 그림
Hold drawing longer (+1)|ค้างภาพนานขึ้น (+1)|Tenir le dessin plus longtemps (+1)|Mantener dibujo más tiempo (+1)|Manter desenho por mais tempo (+1)|Zeichnung länger halten (+1)|絵を長く表示（+1）|画面延长（+1）|그림 더 길게 (+1)
Hold drawing shorter (−1)|ค้างภาพสั้นลง (−1)|Tenir le dessin moins longtemps (−1)|Mantener dibujo menos tiempo (−1)|Manter desenho por menos tempo (−1)|Zeichnung kürzer halten (−1)|絵を短く表示（−1）|画面缩短（−1）|그림 더 짧게 (−1)
Reverse drawings (play range)|กลับลำดับภาพ (ช่วงเล่น)|Inverser les dessins (plage de lecture)|Invertir dibujos (rango)|Inverter desenhos (intervalo)|Zeichnungen umkehren (Abspielbereich)|絵を逆順に（再生範囲）|反转画面（播放范围）|그림 역순 (재생 범위)
Play from this frame (set start)|เล่นจากเฟรมนี้ (ตั้งจุดเริ่ม)|Lire depuis cette image (début)|Reproducir desde este fotograma (inicio)|Reproduzir a partir deste quadro (início)|Ab diesem Bild abspielen (Start)|このフレームから再生（開始）|从此帧播放（设为开始）|이 프레임부터 재생 (시작)
Play until this frame (set end)|เล่นถึงเฟรมนี้ (ตั้งจุดจบ)|Lire jusqu'à cette image (fin)|Reproducir hasta este fotograma (fin)|Reproduzir até este quadro (fim)|Bis zu diesem Bild abspielen (Ende)|このフレームまで再生（終了）|播放到此帧（设为结束）|이 프레임까지 재생 (끝)
Play all frames|เล่นทุกเฟรม|Lire toutes les images|Reproducir todos los fotogramas|Reproduzir todos os quadros|Alle Bilder abspielen|全フレームを再生|播放所有帧|모든 프레임 재생
Ping-pong playback on / off|เล่นไปกลับ เปิด / ปิด|Lecture aller-retour oui / non|Reproducción ida y vuelta sí / no|Reprodução vai e volta liga / desliga|Ping-Pong-Wiedergabe an / aus|往復再生 オン / オフ|往返播放 开 / 关|왕복 재생 켜기 / 끄기
Hair & cloth bones (bend and flow)|กระดูกผมและผ้า (โค้งและพลิ้ว)|Os de cheveux et tissu (plier et flotter)|Huesos de pelo y tela (doblar y ondear)|Ossos de cabelo e tecido (dobrar e ondular)|Haar- und Stoffknochen (biegen und fließen)|髪と布のボーン（曲げて揺らす）|头发和布料骨骼（弯曲与飘动）|머리카락·천 뼈 (휘고 흐르기)
Hair & cloth practice model|โมเดลฝึกผมและผ้า|Modèle d'exercice cheveux et tissu|Modelo de práctica de pelo y tela|Modelo de prática de cabelo e tecido|Übungsmodell Haare und Stoff|髪と布の練習モデル|头发和布料练习模型|머리카락·천 연습 모델
Swap drawings tutorial (practice file)|บทเรียนสลับภาพ (ไฟล์ฝึก)|Tutoriel dessins de remplacement (fichier d'exercice)|Tutorial de dibujos de cambio (archivo de práctica)|Tutorial de desenhos de troca (arquivo de prática)|Tutorial Austauschzeichnungen (Übungsdatei)|差し替え絵のチュートリアル（練習ファイル）|替换画面教程（练习文件）|교체 그림 튜토리얼 (연습 파일)
Swap: add this drawing|สลับ: เพิ่มภาพนี้|Remplacement : ajouter ce dessin|Cambio: añadir este dibujo|Troca: adicionar este desenho|Austausch: diese Zeichnung hinzufügen|差し替え：この絵を追加|替换：添加此画面|교체: 이 그림 추가
Swap: next drawing|สลับ: ภาพถัดไป|Remplacement : dessin suivant|Cambio: dibujo siguiente|Troca: próximo desenho|Austausch: nächste Zeichnung|差し替え：次の絵|替换：下一个画面|교체: 다음 그림
Swap: previous drawing|สลับ: ภาพก่อนหน้า|Remplacement : dessin précédent|Cambio: dibujo anterior|Troca: desenho anterior|Austausch: vorherige Zeichnung|差し替え：前の絵|替换：上一个画面|교체: 이전 그림
Face sliders (blink, mouth, smile)|แถบปรับใบหน้า (กะพริบตา ปาก ยิ้ม)|Curseurs du visage (cligner, bouche, sourire)|Controles de cara (parpadeo, boca, sonrisa)|Controles do rosto (piscar, boca, sorriso)|Gesichtsregler (Blinzeln, Mund, Lächeln)|顔スライダー（まばたき、口、笑顔）|面部滑块（眨眼、嘴巴、微笑）|얼굴 슬라이더 (깜빡임, 입, 미소)
Blink here|กะพริบตาที่นี่|Cligner ici|Parpadear aquí|Piscar aqui|Hier blinzeln|ここでまばたき|在此眨眼|여기서 깜빡이기
Make main part (everything follows it)|ตั้งเป็นส่วนหลัก (ทุกอย่างตาม)|Partie principale (tout la suit)|Parte principal (todo la sigue)|Parte principal (tudo a segue)|Hauptteil (alles folgt ihm)|メインパーツにする（すべてが追従）|设为主部件（其余跟随）|주요 부위로 (모두 따라옴)
Gravity bone (hair, cloth, tail)|กระดูกแรงโน้มถ่วง (ผม ผ้า หาง)|Os à gravité (cheveux, tissu, queue)|Hueso con gravedad (pelo, tela, cola)|Osso com gravidade (cabelo, tecido, cauda)|Schwerkraft-Knochen (Haare, Stoff, Schwanz)|重力ボーン（髪、布、しっぽ）|重力骨骼（头发、布料、尾巴）|중력 뼈 (머리카락, 천, 꼬리)
View|มุมมอง|Affichage|Ver|Exibir|Ansicht|表示|视图|보기
Zoom in|ซูมเข้า|Zoom avant|Acercar|Aproximar|Vergrößern|ズームイン|放大|확대
Zoom out|ซูมออก|Zoom arrière|Alejar|Afastar|Verkleinern|ズームアウト|缩小|축소
Fit to screen|พอดีหน้าจอ|Ajuster à l'écran|Ajustar a la pantalla|Ajustar à tela|An Bildschirm anpassen|画面に合わせる|适合屏幕|화면에 맞추기
Actual size|ขนาดจริง|Taille réelle|Tamaño real|Tamanho real|Originalgröße|実寸|实际大小|실제 크기
Rotate left|หมุนซ้าย|Pivoter à gauche|Girar a la izquierda|Girar para a esquerda|Nach links drehen|左に回転|向左旋转|왼쪽으로 회전
Rotate right|หมุนขวา|Pivoter à droite|Girar a la derecha|Girar para a direita|Nach rechts drehen|右に回転|向右旋转|오른쪽으로 회전
Reset rotation|รีเซ็ตการหมุน|Réinitialiser la rotation|Restablecer rotación|Redefinir rotação|Drehung zurücksetzen|回転をリセット|重置旋转|회전 초기화
Flip horizontally|พลิกแนวนอน|Retourner horizontalement|Voltear horizontalmente|Espelhar horizontalmente|Horizontal spiegeln|左右反転|水平翻转|좌우 반전
Touch draws (toggle)|นิ้ววาดได้ (สลับ)|Le doigt dessine (bascule)|El dedo dibuja (alternar)|O dedo desenha (alternar)|Finger zeichnet (umschalten)|指で描く（切り替え）|手指绘画（切换）|손가락으로 그리기 (전환)
Pen pressure & touch|แรงกดปากกาและการสัมผัส|Pression du stylet et tactile|Presión del lápiz y táctil|Pressão da caneta e toque|Stiftdruck und Touch|筆圧とタッチ|笔压与触控|필압과 터치
Hold to pick colour (on / off)|กดค้างเพื่อดูดสี (เปิด / ปิด)|Maintenir pour prendre la couleur (oui / non)|Mantener para tomar color (sí / no)|Segurar para pegar a cor (liga / desliga)|Halten zum Farbe aufnehmen (an / aus)|長押しで色を取得（オン / オフ）|长按取色（开 / 关）|길게 눌러 색 추출 (켜기 / 끄기)
Hold to snap shapes (on / off)|กดค้างเพื่อจัดรูปทรง (เปิด / ปิด)|Maintenir pour former une figure (oui / non)|Mantener para ajustar formas (sí / no)|Segurar para ajustar formas (liga / desliga)|Halten für Formen (an / aus)|長押しで図形に（オン / オフ）|长按变为形状（开 / 关）|길게 눌러 도형으로 (켜기 / 끄기)
Graphics card for blend / mixing brushes (on / off)|การ์ดจอสำหรับพู่กันผสมสี (เปิด / ปิด)|Carte graphique pour les pinceaux de mélange (oui / non)|Tarjeta gráfica para pinceles de mezcla (sí / no)|Placa de vídeo para pincéis de mistura (liga / desliga)|Grafikkarte für Mischpinsel (an / aus)|混色ブラシにグラフィックカード（オン / オフ）|混色笔刷使用显卡（开 / 关）|혼합 브러시에 그래픽 카드 (켜기 / 끄기)
Two-column tool palette|แถบเครื่องมือสองคอลัมน์|Palette d'outils sur deux colonnes|Paleta de herramientas en dos columnas|Paleta de ferramentas em duas colunas|Werkzeugpalette zweispaltig|ツールパレットを2列に|双列工具栏|2열 도구 팔레트
Symmetry on / off|สมมาตร เปิด / ปิด|Symétrie oui / non|Simetría sí / no|Simetria liga / desliga|Symmetrie an / aus|対称 オン / オフ|对称 开 / 关|대칭 켜기 / 끄기
Symmetry: mirror left / right|สมมาตร: กระจกซ้าย / ขวา|Symétrie : miroir gauche / droite|Simetría: espejo izquierda / derecha|Simetria: espelho esquerda / direita|Symmetrie: links / rechts spiegeln|対称：左右ミラー|对称：左右镜像|대칭: 좌우 거울
Symmetry: mirror top / bottom|สมมาตร: กระจกบน / ล่าง|Symétrie : miroir haut / bas|Simetría: espejo arriba / abajo|Simetria: espelho cima / baixo|Symmetrie: oben / unten spiegeln|対称：上下ミラー|对称：上下镜像|대칭: 상하 거울
Symmetry: 4-way|สมมาตร: 4 ทิศ|Symétrie : 4 directions|Simetría: 4 direcciones|Simetria: 4 direções|Symmetrie: 4-fach|対称：4方向|对称：四向|대칭: 4방향
Symmetry: radial|สมมาตร: รัศมี|Symétrie : radiale|Simetría: radial|Simetria: radial|Symmetrie: radial|対称：放射|对称：径向|대칭: 방사형
Symmetry: kaleidoscope|สมมาตร: คาไลโดสโคป|Symétrie : kaléidoscope|Simetría: caleidoscopio|Simetria: caleidoscópio|Symmetrie: Kaleidoskop|対称：万華鏡|对称：万花筒|대칭: 만화경
Filter|ฟิลเตอร์|Filtre|Filtro|Filtro|Filter|フィルター|滤镜|필터
Blur|เบลอ|Flou|Desenfoque|Desfoque|Weichzeichnen|ぼかし|模糊|흐리기
Blur (strong)|เบลอ (แรง)|Flou (fort)|Desenfoque (fuerte)|Desfoque (forte)|Weichzeichnen (stark)|ぼかし（強）|模糊（强）|흐리기 (강하게)
Gaussian blur|เบลอแบบเกาส์เซียน|Flou gaussien|Desenfoque gaussiano|Desfoque gaussiano|Gaußscher Weichzeichner|ガウスぼかし|高斯模糊|가우스 흐리기
Motion blur|เบลอการเคลื่อนไหว|Flou de mouvement|Desenfoque de movimiento|Desfoque de movimento|Bewegungsunschärfe|移動ぼかし|动感模糊|모션 흐리기
Sharpen|เพิ่มความคม|Netteté|Enfocar|Nitidez|Schärfen|シャープ|锐化|선명하게
Mosaic|โมเสก|Mosaïque|Mosaico|Mosaico|Mosaik|モザイク|马赛克|모자이크
Noise|นอยส์|Bruit|Ruido|Ruído|Rauschen|ノイズ|杂色|노이즈
Radial blur|เบลอแบบรัศมี|Flou radial|Desenfoque radial|Desfoque radial|Radialer Weichzeichner|放射ぼかし|径向模糊|방사형 흐리기
Tone curve|โทนเคิร์ฟ|Courbe de tons|Curva de tonos|Curva de tons|Gradationskurve|トーンカーブ|色调曲线|톤 커브
Colour balance|สมดุลสี|Balance des couleurs|Equilibrio de color|Equilíbrio de cores|Farbbalance|カラーバランス|色彩平衡|색상 균형
Gradient map|แผนที่ไล่สี|Courbe de dégradé|Mapa de degradado|Mapa de gradiente|Verlaufsumsetzung|グラデーションマップ|渐变映射|그라데이션 맵
Invert colours|กลับสี|Inverser les couleurs|Invertir colores|Inverter cores|Farben umkehren|色を反転|反转颜色|색 반전
Posterize|โปสเตอร์ไรซ์|Postériser|Posterizar|Posterizar|Tontrennung|ポスタリゼーション|色调分离|포스터화
Binarize (B&W)|ขาวดำ|Noir et blanc (seuil)|Binarizar (B/N)|Binarizar (P&B)|Schwarzweiß (Schwelle)|2値化（白黒）|二值化（黑白）|이진화 (흑백)
Glow|เรืองแสง|Lueur|Resplandor|Brilho|Leuchten|グロー|发光|광채
Drop shadow|เงาตกกระทบ|Ombre portée|Sombra paralela|Sombra projetada|Schlagschatten|ドロップシャドウ|投影|그림자
Outline (border)|เส้นขอบ|Contour|Contorno|Contorno|Kontur|フチ（境界線）|描边|외곽선
Bloom (soft light)|บลูม (แสงนุ่ม)|Éclat (lumière douce)|Bloom (luz suave)|Bloom (luz suave)|Bloom (weiches Licht)|ブルーム（柔らかい光）|泛光（柔光）|블룸 (부드러운 빛)
Extract line art (trace a photo)|ดึงเส้นร่าง (จากรูปถ่าย)|Extraire le trait (d'une photo)|Extraer líneas (de una foto)|Extrair traço (de uma foto)|Linien extrahieren (aus Foto)|線画抽出（写真から）|提取线稿（照片描线）|선화 추출 (사진에서)
Emboss|นูน|Estampage|Relieve|Relevo|Prägen|エンボス|浮雕|엠보스
Halftone dots|จุดฮาล์ฟโทน|Trame de points|Semitono|Meio-tom|Rasterpunkte|網点|半调网点|하프톤 점
Oil paint|สีน้ำมัน|Peinture à l'huile|Pintura al óleo|Pintura a óleo|Ölfarbe|油絵|油画|유화
Vignette|ขอบมืด|Vignette|Viñeta|Vinheta|Vignette|周辺減光|暗角|비네트
Chromatic aberration|ความคลาดสี|Aberration chromatique|Aberración cromática|Aberração cromática|Chromatische Aberration|色収差|色差|색수차
Glitch|กลิตช์|Glitch|Glitch|Glitch|Glitch|グリッチ|故障效果|글리치
Twirl|บิดเกลียว|Tourbillon|Remolino|Redemoinho|Strudel|渦巻き|旋转扭曲|소용돌이
Pinch / bulge|หด / พอง|Pincement / renflement|Pellizcar / abultar|Comprimir / inflar|Zusammenziehen / Wölben|つまむ / 膨らませる|收缩 / 膨胀|오목 / 볼록
Wave / ripple|คลื่น / ระลอก|Vague / ondulation|Onda / ondulación|Onda / ondulação|Welle / Kräuseln|波 / 波紋|波浪 / 波纹|물결 / 파문
Grayscale|ขาวดำเฉดเทา|Niveaux de gris|Escala de grises|Tons de cinza|Graustufen|グレースケール|灰度|회색조
Sepia|ซีเปีย|Sépia|Sepia|Sépia|Sepia|セピア|棕褐色|세피아
Hue / saturation / brightness|ฮิว / ความอิ่มตัว / ความสว่าง|Teinte / saturation / luminosité|Tono / saturación / brillo|Matiz / saturação / brilho|Farbton / Sättigung / Helligkeit|色相 / 彩度 / 明るさ|色相 / 饱和度 / 亮度|색조 / 채도 / 밝기
Brightness & contrast|ความสว่างและคอนทราสต์|Luminosité et contraste|Brillo y contraste|Brilho e contraste|Helligkeit und Kontrast|明るさとコントラスト|亮度和对比度|밝기와 대비
Duotone|ดูโอโทน|Bichromie|Duotono|Duotone|Duplex|ダブルトーン|双色调|듀오톤
Light leak|แสงรั่ว|Fuite de lumière|Fuga de luz|Vazamento de luz|Lichtleck|光漏れ|漏光|빛샘
Lens flare|แสงแฟลร์|Reflet d'objectif|Destello de lente|Reflexo de lente|Blendenfleck|レンズフレア|镜头光晕|렌즈 플레어
Neon edges|ขอบนีออน|Contours néon|Bordes de neón|Bordas neon|Neonkanten|ネオンエッジ|霓虹边缘|네온 윤곽
Pixel art|พิกเซลอาร์ต|Pixel art|Pixel art|Pixel art|Pixel-Art|ドット絵|像素画|픽셀 아트
Cartoon (cel look)|การ์ตูน (แบบเซล)|Dessin animé (aplats)|Dibujo animado (celuloide)|Desenho animado (cel)|Cartoon (Cel-Look)|アニメ塗り風|卡通（赛璐璐）|만화 (셀 느낌)
Pencil sketch|ภาพร่างดินสอ|Croquis au crayon|Boceto a lápiz|Esboço a lápis|Bleistiftskizze|鉛筆スケッチ|铅笔素描|연필 스케치
Old film|ฟิล์มเก่า|Vieux film|Película antigua|Filme antigo|Alter Film|古いフィルム|老电影|오래된 필름
VHS / scanlines|VHS / เส้นสแกน|VHS / lignes de balayage|VHS / líneas de escaneo|VHS / linhas de varredura|VHS / Zeilen|VHS / 走査線|VHS / 扫描线|VHS / 주사선
Window|หน้าต่าง|Fenêtre|Ventana|Janela|Fenster|ウィンドウ|窗口|창
Reset panel layout|รีเซ็ตการจัดแผง|Réinitialiser les panneaux|Restablecer paneles|Redefinir painéis|Panel-Layout zurücksetzen|パネル配置をリセット|重置面板布局|패널 배치 초기화
Next document|เอกสารถัดไป|Document suivant|Documento siguiente|Próximo documento|Nächstes Dokument|次の書類|下一个文档|다음 문서
Previous document|เอกสารก่อนหน้า|Document précédent|Documento anterior|Documento anterior|Vorheriges Dokument|前の書類|上一个文档|이전 문서
Move document to new window|ย้ายเอกสารไปหน้าต่างใหม่|Déplacer le document dans une nouvelle fenêtre|Mover documento a una ventana nueva|Mover documento para nova janela|Dokument in neues Fenster verschieben|書類を新しいウィンドウへ移動|将文档移到新窗口|문서를 새 창으로 이동
Open a copy in new window|เปิดสำเนาในหน้าต่างใหม่|Ouvrir une copie dans une nouvelle fenêtre|Abrir una copia en una ventana nueva|Abrir uma cópia em nova janela|Kopie in neuem Fenster öffnen|コピーを新しいウィンドウで開く|在新窗口打开副本|새 창에서 사본 열기
Second view (show / hide)|มุมมองที่สอง (แสดง / ซ่อน)|Seconde vue (afficher / masquer)|Segunda vista (mostrar / ocultar)|Segunda vista (mostrar / ocultar)|Zweite Ansicht (ein / aus)|サブビュー（表示 / 非表示）|第二视图（显示 / 隐藏）|두 번째 보기 (보이기 / 숨기기)
Sub Tool (show / hide)|เครื่องมือย่อย (แสดง / ซ่อน)|Sous-outil (afficher / masquer)|Subherramienta (mostrar / ocultar)|Subferramenta (mostrar / ocultar)|Unterwerkzeug (ein / aus)|サブツール（表示 / 非表示）|辅助工具（显示 / 隐藏）|보조 도구 (보이기 / 숨기기)
Tool Property (show / hide)|คุณสมบัติเครื่องมือ (แสดง / ซ่อน)|Propriétés de l'outil (afficher / masquer)|Propiedades de herramienta (mostrar / ocultar)|Propriedades da ferramenta (mostrar / ocultar)|Werkzeugeigenschaften (ein / aus)|ツールプロパティ（表示 / 非表示）|工具属性（显示 / 隐藏）|도구 속성 (보이기 / 숨기기)
Color (show / hide)|สี (แสดง / ซ่อน)|Couleur (afficher / masquer)|Color (mostrar / ocultar)|Cor (mostrar / ocultar)|Farbe (ein / aus)|カラー（表示 / 非表示）|颜色（显示 / 隐藏）|색 (보이기 / 숨기기)
Navigator (show / hide)|ตัวนำทาง (แสดง / ซ่อน)|Navigateur (afficher / masquer)|Navegador (mostrar / ocultar)|Navegador (mostrar / ocultar)|Navigator (ein / aus)|ナビゲーター（表示 / 非表示）|导航器（显示 / 隐藏）|내비게이터 (보이기 / 숨기기)
3D Model (show / hide)|โมเดล 3D (แสดง / ซ่อน)|Modèle 3D (afficher / masquer)|Modelo 3D (mostrar / ocultar)|Modelo 3D (mostrar / ocultar)|3D-Modell (ein / aus)|3Dモデル（表示 / 非表示）|3D 模型（显示 / 隐藏）|3D 모델 (보이기 / 숨기기)
Layer Property (show / hide)|คุณสมบัติเลเยอร์ (แสดง / ซ่อน)|Propriétés du calque (afficher / masquer)|Propiedades de capa (mostrar / ocultar)|Propriedades da camada (mostrar / ocultar)|Ebeneneigenschaften (ein / aus)|レイヤープロパティ（表示 / 非表示）|图层属性（显示 / 隐藏）|레이어 속성 (보이기 / 숨기기)
Layer (show / hide)|เลเยอร์ (แสดง / ซ่อน)|Calques (afficher / masquer)|Capas (mostrar / ocultar)|Camadas (mostrar / ocultar)|Ebenen (ein / aus)|レイヤー（表示 / 非表示）|图层（显示 / 隐藏）|레이어 (보이기 / 숨기기)
Drawing library (show / hide)|คลังภาพวาด (แสดง / ซ่อน)|Bibliothèque de dessins (afficher / masquer)|Biblioteca de dibujos (mostrar / ocultar)|Biblioteca de desenhos (mostrar / ocultar)|Zeichnungsbibliothek (ein / aus)|絵のライブラリ（表示 / 非表示）|画面库（显示 / 隐藏）|그림 라이브러리 (보이기 / 숨기기)
Pages panel (manga / comic: auto / off)|แผงหน้า (มังงะ / การ์ตูน: อัตโนมัติ / ปิด)|Panneau Pages (manga / BD : auto / non)|Panel de páginas (manga / cómic: auto / no)|Painel de páginas (mangá / HQ: auto / desligado)|Seitenpanel (Manga / Comic: auto / aus)|ページパネル（マンガ：自動 / オフ）|页面面板（漫画：自动 / 关）|페이지 패널 (만화: 자동 / 끄기)
Add-ons|ส่วนเสริม|Extensions|Complementos|Complementos|Erweiterungen|アドオン|附加组件|애드온
Create a new brush|สร้างพู่กันใหม่|Créer un nouveau pinceau|Crear un pincel nuevo|Criar um novo pincel|Neuen Pinsel erstellen|新しいブラシを作成|创建新笔刷|새 브러시 만들기
Edit this brush (all settings)|แก้ไขพู่กันนี้ (ทุกการตั้งค่า)|Modifier ce pinceau (tous les réglages)|Editar este pincel (todos los ajustes)|Editar este pincel (todas as configurações)|Diesen Pinsel bearbeiten (alle Einstellungen)|このブラシを編集（すべての設定）|编辑此笔刷（全部设置）|이 브러시 편집 (모든 설정)
Import Clip Studio tools (.sut, .zip)|นำเข้าเครื่องมือ Clip Studio (.sut, .zip)|Importer des outils Clip Studio (.sut, .zip)|Importar herramientas de Clip Studio (.sut, .zip)|Importar ferramentas do Clip Studio (.sut, .zip)|Clip-Studio-Werkzeuge importieren (.sut, .zip)|Clip Studio のツールを読み込む（.sut, .zip）|导入 Clip Studio 工具（.sut, .zip）|Clip Studio 도구 가져오기 (.sut, .zip)
Import a folder of Clip Studio tools|นำเข้าโฟลเดอร์เครื่องมือ Clip Studio|Importer un dossier d'outils Clip Studio|Importar una carpeta de herramientas de Clip Studio|Importar uma pasta de ferramentas do Clip Studio|Ordner mit Clip-Studio-Werkzeugen importieren|Clip Studio のツールのフォルダーを読み込む|导入 Clip Studio 工具文件夹|Clip Studio 도구 폴더 가져오기
Import brush tip (image)|นำเข้าหัวพู่กัน (รูปภาพ)|Importer une pointe de pinceau (image)|Importar punta de pincel (imagen)|Importar ponta de pincel (imagem)|Pinselspitze importieren (Bild)|ブラシ先端を読み込む（画像）|导入笔尖（图像）|브러시 끝 가져오기 (이미지)
Install add-on script (.js)|ติดตั้งสคริปต์ส่วนเสริม (.js)|Installer un script d'extension (.js)|Instalar script de complemento (.js)|Instalar script de complemento (.js)|Erweiterungsskript installieren (.js)|アドオンスクリプトをインストール（.js）|安装附加脚本（.js）|애드온 스크립트 설치 (.js)
Manage add-ons|จัดการส่วนเสริม|Gérer les extensions|Gestionar complementos|Gerenciar complementos|Erweiterungen verwalten|アドオンを管理|管理附加组件|애드온 관리
Tune imported tools for smooth drawing|ปรับเครื่องมือที่นำเข้าให้วาดลื่น|Régler les outils importés pour un dessin fluide|Ajustar herramientas importadas para dibujar con fluidez|Ajustar ferramentas importadas para desenhar suave|Importierte Werkzeuge für flüssiges Zeichnen abstimmen|読み込んだツールを滑らかに描けるよう調整|优化导入的工具以流畅绘画|가져온 도구를 부드럽게 조정
Customise the interface|ปรับแต่งหน้าตา|Personnaliser l'interface|Personalizar la interfaz|Personalizar a interface|Oberfläche anpassen|インターフェースをカスタマイズ|自定义界面|인터페이스 사용자 지정
Colours|สี|Couleurs|Colores|Cores|Farben|色|颜色|색
Icons|ไอคอน|Icônes|Iconos|Ícones|Symbole|アイコン|图标|아이콘
Text|ข้อความ|Texte|Texto|Texto|Text|テキスト|文字|텍스트
Layout|การจัดวาง|Disposition|Diseño|Layout|Layout|レイアウト|布局|레이아웃
Canvas|ผืนผ้าใบ|Canevas|Lienzo|Tela|Leinwand|キャンバス|画布|캔버스
Cursor|เคอร์เซอร์|Curseur|Cursor|Cursor|Mauszeiger|カーソル|光标|커서
Effects|เอฟเฟกต์|Effets|Efectos|Efeitos|Effekte|エフェクト|效果|효과
Surprise me (random theme)|สุ่มธีม|Surprends-moi (thème au hasard)|Sorpréndeme (tema al azar)|Surpreenda-me (tema aleatório)|Überrasch mich (zufälliges Thema)|おまかせ（ランダムなテーマ）|随机主题|무작위 테마
Save current as theme|บันทึกเป็นธีม|Enregistrer comme thème|Guardar como tema|Salvar como tema|Als Thema speichern|現在の設定をテーマとして保存|将当前保存为主题|현재 설정을 테마로 저장
Export theme file|ส่งออกไฟล์ธีม|Exporter le thème|Exportar archivo de tema|Exportar arquivo de tema|Themendatei exportieren|テーマファイルを書き出す|导出主题文件|테마 파일 내보내기
Import theme file|นำเข้าไฟล์ธีม|Importer un thème|Importar archivo de tema|Importar arquivo de tema|Themendatei importieren|テーマファイルを読み込む|导入主题文件|테마 파일 가져오기
Reset to default|รีเซ็ตเป็นค่าเริ่มต้น|Réinitialiser|Restablecer|Redefinir padrão|Auf Standard zurücksetzen|初期設定に戻す|恢复默认|기본값으로 초기화
Account|บัญชี|Compte|Cuenta|Conta|Konto|アカウント|账户|계정
Sign in / my account|เข้าสู่ระบบ / บัญชีของฉัน|Connexion / mon compte|Iniciar sesión / mi cuenta|Entrar / minha conta|Anmelden / mein Konto|サインイン / マイアカウント|登录 / 我的账户|로그인 / 내 계정
Save this drawing to the cloud|บันทึกภาพนี้ขึ้นคลาวด์|Enregistrer ce dessin dans le cloud|Guardar este dibujo en la nube|Salvar este desenho na nuvem|Diese Zeichnung in der Cloud speichern|この絵をクラウドに保存|将此画保存到云端|이 그림을 클라우드에 저장
My cloud files|ไฟล์คลาวด์ของฉัน|Mes fichiers dans le cloud|Mis archivos en la nube|Meus arquivos na nuvem|Meine Cloud-Dateien|クラウドのファイル|我的云端文件|내 클라우드 파일
Upload my settings|อัปโหลดการตั้งค่า|Envoyer mes réglages|Subir mis ajustes|Enviar minhas configurações|Meine Einstellungen hochladen|設定をアップロード|上传我的设置|내 설정 업로드
Get my settings|ดึงการตั้งค่า|Récupérer mes réglages|Obtener mis ajustes|Baixar minhas configurações|Meine Einstellungen holen|設定を取得|获取我的设置|내 설정 가져오기
Brushes & themes library|คลังพู่กันและธีม|Bibliothèque de pinceaux et thèmes|Biblioteca de pinceles y temas|Biblioteca de pincéis e temas|Pinsel- und Themenbibliothek|ブラシとテーマのライブラリ|笔刷和主题库|브러시·테마 라이브러리
Help|ช่วยเหลือ|Aide|Ayuda|Ajuda|Hilfe|ヘルプ|帮助|도움말
Ask the helper (free)|ถามผู้ช่วย (ฟรี)|Demander à l'aide (gratuit)|Preguntar al asistente (gratis)|Perguntar ao assistente (grátis)|Hilfe fragen (kostenlos)|ヘルパーに質問（無料）|询问助手（免费）|도우미에게 묻기 (무료)
Community: share art, tools, reviews|ชุมชน: แชร์งาน เครื่องมือ รีวิว|Communauté : partager dessins, outils, avis|Comunidad: comparte arte, herramientas, opiniones|Comunidade: compartilhe arte, ferramentas, avaliações|Community: Kunst, Werkzeuge, Bewertungen teilen|コミュニティ：作品・ツール・レビューを共有|社区：分享作品、工具、评价|커뮤니티: 작품·도구·리뷰 공유
Tutorials|บทเรียน|Tutoriels|Tutoriales|Tutoriais|Anleitungen|チュートリアル|教程|튜토리얼
Welcome tour|ทัวร์แนะนำ|Visite guidée|Recorrido de bienvenida|Tour de boas-vindas|Willkommenstour|ようこそツアー|欢迎导览|환영 투어
Your first drawing|ภาพแรกของคุณ|Ton premier dessin|Tu primer dibujo|Seu primeiro desenho|Deine erste Zeichnung|はじめての絵|你的第一幅画|첫 그림
Every tool, one by one|ทุกเครื่องมือ ทีละอัน|Chaque outil, un par un|Cada herramienta, una a una|Cada ferramenta, uma por uma|Jedes Werkzeug, eins nach dem anderen|すべてのツールを1つずつ|逐个了解每个工具|모든 도구 하나씩
All menus and options|ทุกเมนูและตัวเลือก|Tous les menus et options|Todos los menús y opciones|Todos os menus e opções|Alle Menüs und Optionen|すべてのメニューとオプション|所有菜单和选项|모든 메뉴와 옵션
Layers & selections|เลเยอร์และการเลือก|Calques et sélections|Capas y selecciones|Camadas e seleções|Ebenen und Auswahlen|レイヤーと選択範囲|图层和选区|레이어와 선택
Pen tablet & pressure|เมาส์ปากกาและแรงกด|Tablette graphique et pression|Tableta y presión|Mesa digitalizadora e pressão|Grafiktablett und Druck|ペンタブレットと筆圧|数位板和笔压|펜 태블릿과 필압
Make an animation|ทำแอนิเมชัน|Faire une animation|Hacer una animación|Fazer uma animação|Eine Animation erstellen|アニメーションを作る|制作动画|애니메이션 만들기
Every animation tool|ทุกเครื่องมือแอนิเมชัน|Tous les outils d'animation|Todas las herramientas de animación|Todas as ferramentas de animação|Alle Animationswerkzeuge|すべてのアニメーションツール|所有动画工具|모든 애니메이션 도구
Motion tweens|โมชันทวีน|Interpolations de mouvement|Interpolaciones de movimiento|Interpolações de movimento|Bewegungs-Tweens|モーショントゥイーン|补间动画|모션 트윈
Make a manga page|ทำหน้ามังงะ|Faire une page de manga|Hacer una página de manga|Fazer uma página de mangá|Eine Manga-Seite erstellen|マンガのページを作る|制作漫画页|만화 페이지 만들기
Install the app|ติดตั้งแอป|Installer l'application|Instalar la aplicación|Instalar o aplicativo|App installieren|アプリをインストール|安装应用|앱 설치
Shortcuts & help|ทางลัดและความช่วยเหลือ|Raccourcis et aide|Atajos y ayuda|Atalhos e ajuda|Tastenkürzel und Hilfe|ショートカットとヘルプ|快捷键和帮助|단축키와 도움말
Play the welcome animation|เล่นแอนิเมชันต้อนรับ|Rejouer l'animation d'accueil|Ver la animación de bienvenida|Ver a animação de boas-vindas|Willkommensanimation abspielen|ようこそアニメーションを再生|播放欢迎动画|환영 애니메이션 재생
What's new in this version|มีอะไรใหม่ในเวอร์ชันนี้|Nouveautés de cette version|Novedades de esta versión|Novidades desta versão|Neu in dieser Version|このバージョンの新機能|此版本的新功能|이 버전의 새 기능
Check for updates|ตรวจหาอัปเดต|Rechercher des mises à jour|Buscar actualizaciones|Verificar atualizações|Nach Updates suchen|アップデートを確認|检查更新|업데이트 확인
About Inkvessa|เกี่ยวกับ Inkvessa|À propos de Inkvessa|Acerca de Inkvessa|Sobre o Inkvessa|Über Inkvessa|Inkvessa について|关于 Inkvessa|Inkvessa 정보
Language|ภาษา|Langue|Idioma|Idioma|Sprache|言語|语言|언어
Drawing|วาดภาพ|Dessin|Dibujo|Desenho|Zeichnen|イラスト|绘画|그리기
Ask|ถาม|Aide|Preguntar|Perguntar|Fragen|質問|提问|질문
Sign in|เข้าสู่ระบบ|Connexion|Iniciar sesión|Entrar|Anmelden|サインイン|登录|로그인
Panels|แผง|Panneaux|Paneles|Painéis|Panels|パネル|面板|패널
Symmetry|สมมาตร|Symétrie|Simetría|Simetria|Symmetrie|対称|对称|대칭
3D model|โมเดล 3D|Modèle 3D|Modelo 3D|Modelo 3D|3D-Modell|3Dモデル|3D 模型|3D 모델
3D Model|โมเดล 3D|Modèle 3D|Modelo 3D|Modelo 3D|3D-Modell|3Dモデル|3D 模型|3D 모델
Page|หน้า|Page|Página|Página|Seite|ページ|页|페이지
Pages|หน้า|Pages|Páginas|Páginas|Seiten|ページ|页面|페이지
Home|หน้าแรก|Accueil|Inicio|Início|Start|ホーム|主页|홈
Untitled|ไม่มีชื่อ|Sans titre|Sin título|Sem título|Unbenannt|無題|未命名|제목 없음
Sub Tool|เครื่องมือย่อย|Sous-outil|Subherramienta|Subferramenta|Unterwerkzeug|サブツール|辅助工具|보조 도구
Drop tools here|วางเครื่องมือที่นี่|Déposer des outils ici|Suelta herramientas aquí|Solte ferramentas aqui|Werkzeuge hier ablegen|ここにツールをドロップ|将工具拖到这里|여기에 도구 놓기
Tool Property|คุณสมบัติเครื่องมือ|Propriétés de l'outil|Propiedades de herramienta|Propriedades da ferramenta|Werkzeugeigenschaften|ツールプロパティ|工具属性|도구 속성
Size|ขนาด|Taille|Tamaño|Tamanho|Größe|サイズ|大小|크기
Hardness|ความแข็ง|Dureté|Dureza|Dureza|Härte|硬さ|硬度|경도
Density|ความเข้ม|Densité|Densidad|Densidade|Dichte|濃度|浓度|농도
Opacity|ความทึบ|Opacité|Opacidad|Opacidade|Deckkraft|不透明度|不透明度|불투명도
Texture|เนื้อพื้นผิว|Texture|Textura|Textura|Struktur|テクスチャ|纹理|질감
Paper|กระดาษ|Papier|Papel|Papel|Papier|用紙|纸张|용지
None|ไม่มี|Aucune|Ninguna|Nenhuma|Keine|なし|无|없음
Load image|โหลดรูปภาพ|Charger une image|Cargar imagen|Carregar imagem|Bild laden|画像を読み込む|载入图像|이미지 불러오기
Stroke character|ลักษณะเส้น|Caractère du trait|Carácter del trazo|Caráter do traço|Strichcharakter|ストロークの性質|笔画特性|획 특성
Scatter|กระจาย|Dispersion|Dispersión|Dispersão|Streuung|散布|散布|흩뿌리기
Per step|ต่อจังหวะ|Par pas|Por paso|Por passo|Pro Schritt|ステップごと|每步|단계마다
Size jitter|ขนาดสุ่ม|Variation de taille|Variación de tamaño|Variação de tamanho|Größenschwankung|サイズのゆらぎ|大小抖动|크기 흔들림
Wet edge|ขอบเปียก|Bord humide|Borde húmedo|Borda úmida|Nasse Kante|水彩境界|湿边|젖은 가장자리
Anti-aliasing|ลบรอยหยัก|Anticrénelage|Suavizado|Suavização|Kantenglättung|アンチエイリアス|抗锯齿|안티에일리어싱
Weak|อ่อน|Faible|Débil|Fraco|Schwach|弱|弱|약하게
Normal|ปกติ|Normal|Normal|Normal|Normal|通常|正常|보통
Strong|แรง|Fort|Fuerte|Forte|Stark|強|强|강하게
Stabilise|ลดการสั่น|Stabiliser|Estabilizar|Estabilizar|Stabilisieren|手ブレ補正|防抖|손떨림 보정
By speed|ตามความเร็ว|Selon la vitesse|Según la velocidad|Pela velocidade|Nach Tempo|速度で|按速度|속도에 따라
Pen pressure|แรงกดปากกา|Pression du stylet|Presión del lápiz|Pressão da caneta|Stiftdruck|筆圧|笔压|필압
Affects size|มีผลกับขนาด|Change la taille|Afecta al tamaño|Afeta o tamanho|Beeinflusst Größe|サイズに影響|影响大小|크기에 영향
Affects density|มีผลกับความเข้ม|Change la densité|Afecta a la densidad|Afeta a densidade|Beeinflusst Dichte|濃度に影響|影响浓度|농도에 영향
Two colours|สองสี|Deux couleurs|Dos colores|Duas cores|Zwei Farben|2色|双色|두 가지 색
One colour|สีเดียว|Une couleur|Un color|Uma cor|Eine Farbe|1色|单色|한 가지 색
All brush settings|การตั้งค่าพู่กันทั้งหมด|Tous les réglages du pinceau|Todos los ajustes del pincel|Todas as configurações do pincel|Alle Pinseleinstellungen|すべてのブラシ設定|全部笔刷设置|모든 브러시 설정
Advanced setup|ตั้งค่าขั้นสูง|Réglages avancés|Ajustes avanzados|Configuração avançada|Erweiterte Einstellungen|詳細設定|高级设置|고급 설정
Color|สี|Couleur|Color|Cor|Farbe|カラー|颜色|색
History|ประวัติ|Historique|Historial|Histórico|Verlauf|履歴|历史|기록
Pose 3D model|จัดท่าโมเดล 3D|Poser le modèle 3D|Posar el modelo 3D|Posar o modelo 3D|3D-Modell posieren|3Dモデルのポーズ|摆 3D 模型姿势|3D 모델 포즈
Navigator|ตัวนำทาง|Navigateur|Navegador|Navegador|Navigator|ナビゲーター|导航器|내비게이터
Fit|พอดี|Ajuster|Ajustar|Ajustar|Einpassen|全体表示|适合|맞추기
Reset|รีเซ็ต|Réinitialiser|Restablecer|Redefinir|Zurücksetzen|リセット|重置|초기화
Flip|พลิก|Retourner|Voltear|Espelhar|Spiegeln|反転|翻转|반전
Load the 3D model|โหลดโมเดล 3D|Charger le modèle 3D|Cargar el modelo 3D|Carregar o modelo 3D|3D-Modell laden|3Dモデルを読み込む|载入 3D 模型|3D 모델 불러오기
Layer Property|คุณสมบัติเลเยอร์|Propriétés du calque|Propiedades de capa|Propriedades da camada|Ebeneneigenschaften|レイヤープロパティ|图层属性|레이어 속성
Blend|การผสม|Fusion|Fusión|Mesclagem|Mischmodus|合成モード|混合|혼합
Darken|มืดลง|Obscurcir|Oscurecer|Escurecer|Abdunkeln|比較（暗）|变暗|어둡게
Multiply|คูณ|Produit|Multiplicar|Multiplicação|Multiplizieren|乗算|正片叠底|곱하기
Lighten|สว่างขึ้น|Éclaircir|Aclarar|Clarear|Aufhellen|比較（明）|变亮|밝게
Screen|สกรีน|Superposition|Trama|Tela|Negativ multiplizieren|スクリーン|滤色|스크린
Overlay|โอเวอร์เลย์|Incrustation|Superponer|Sobrepor|Ineinanderkopieren|オーバーレイ|叠加|오버레이
Soft light|แสงนุ่ม|Lumière tamisée|Luz suave|Luz suave|Weiches Licht|ソフトライト|柔光|소프트 라이트
Hard light|แสงแข็ง|Lumière crue|Luz fuerte|Luz forte|Hartes Licht|ハードライト|强光|하드 라이트
Difference|ผลต่าง|Différence|Diferencia|Diferença|Differenz|差の絶対値|差值|차이
Hue|ฮิว|Teinte|Tono|Matiz|Farbton|色相|色相|색조
Saturation|ความอิ่มตัว|Saturation|Saturación|Saturação|Sättigung|彩度|饱和度|채도
Brightness|ความสว่าง|Luminosité|Brillo|Brilho|Helligkeit|明るさ|亮度|밝기
Frame|เฟรม|Image|Fotograma|Quadro|Bild|フレーム|帧|프레임
Loop|วนซ้ำ|Boucle|Bucle|Repetir|Schleife|ループ|循环|반복
Onion skin|ออเนียนสกิน|Pelure d'oignon|Papel cebolla|Papel cebola|Zwiebelhaut|オニオンスキン|洋葱皮|어니언 스킨
New drawing|ภาพวาดใหม่|Nouveau dessin|Nuevo dibujo|Novo desenho|Neue Zeichnung|新しい絵|新画面|새 그림
Tween|ทวีน|Interpolation|Interpolación|Interpolação|Tween|トゥイーン|补间|트윈
No tween|ไม่มีทวีน|Pas d'interpolation|Sin interpolación|Sem interpolação|Kein Tween|トゥイーンなし|无补间|트윈 없음
Illustration|ภาพประกอบ|Illustration|Ilustración|Ilustração|Illustration|イラスト|插画|일러스트
Comic|การ์ตูน|BD / manga|Cómic|Quadrinhos|Comic|マンガ|漫画|만화
File name|ชื่อไฟล์|Nom du fichier|Nombre de archivo|Nome do arquivo|Dateiname|ファイル名|文件名|파일 이름
Preset|ค่าที่ตั้งไว้|Préréglage|Preajuste|Predefinição|Vorgabe|プリセット|预设|사전 설정
Unit|หน่วย|Unité|Unidad|Unidade|Einheit|単位|单位|단위
Width|ความกว้าง|Largeur|Ancho|Largura|Breite|幅|宽度|너비
Height|ความสูง|Hauteur|Alto|Altura|Höhe|高さ|高度|높이
Resolution|ความละเอียด|Résolution|Resolución|Resolução|Auflösung|解像度|分辨率|해상도
Colour|สี|Couleur|Color|Cor|Farbe|カラー|彩色|컬러
Gray|เทา|Gris|Gris|Cinza|Grau|グレー|灰度|회색
Monochrome|ขาวดำ|Monochrome|Monocromo|Monocromático|Monochrom|モノクロ|单色|흑백
Transparent|โปร่งใส|Transparent|Transparente|Transparente|Transparent|透明|透明|투명
Grain strength|ความแรงของเกรน|Force du grain|Intensidad del grano|Intensidade do grão|Körnungsstärke|粒子の強さ|颗粒强度|입자 강도
Comic settings|ตั้งค่าการ์ตูน|Réglages BD|Ajustes de cómic|Configurações de HQ|Comic-Einstellungen|マンガの設定|漫画设置|만화 설정
Animation settings|ตั้งค่าแอนิเมชัน|Réglages de l'animation|Ajustes de animación|Configurações de animação|Animationseinstellungen|アニメーションの設定|动画设置|애니메이션 설정
Frame rate|อัตราเฟรม|Images par seconde|Fotogramas por segundo|Quadros por segundo|Bildrate|フレームレート|帧率|프레임 속도
Playback time|ระยะเวลาเล่น|Durée de lecture|Duración|Duração|Wiedergabedauer|再生時間|播放时长|재생 시간
Frames|เฟรม|Images|Fotogramas|Quadros|Bilder|フレーム|帧|프레임
Cancel|ยกเลิก|Annuler|Cancelar|Cancelar|Abbrechen|キャンセル|取消|취소
OK|ตกลง|OK|Aceptar|OK|OK|OK|确定|확인
Format|รูปแบบ|Format|Formato|Formato|Format|形式|格式|형식
All frames|ทุกเฟรม|Toutes les images|Todos los fotogramas|Todos os quadros|Alle Bilder|全フレーム|所有帧|모든 프레임
Play range only|เฉพาะช่วงเล่น|Plage de lecture seulement|Solo el rango|Somente o intervalo|Nur Abspielbereich|再生範囲のみ|仅播放范围|재생 범위만
Close|ปิด|Fermer|Cerrar|Fechar|Schließen|閉じる|关闭|닫기
Export|ส่งออก|Exporter|Exportar|Exportar|Exportieren|書き出し|导出|내보내기
Name|ชื่อ|Nom|Nombre|Nome|Name|名前|名称|이름
Keyboard shortcuts|ทางลัดแป้นพิมพ์|Raccourcis clavier|Atajos de teclado|Atalhos de teclado|Tastenkürzel|キーボードショートカット|键盘快捷键|키보드 단축키
Done|เสร็จ|Terminé|Listo|Pronto|Fertig|完了|完成|완료
Hide|ซ่อน|Masquer|Ocultar|Ocultar|Ausblenden|隠す|隐藏|숨기기
Pen|ปากกา|Plume|Pluma|Caneta|Feder|ペン|钢笔|펜
Pencil|ดินสอ|Crayon|Lápiz|Lápis|Bleistift|鉛筆|铅笔|연필
Brush|พู่กัน|Pinceau|Pincel|Pincel|Pinsel|筆|画笔|붓
Eraser|ยางลบ|Gomme|Borrador|Borracha|Radierer|消しゴム|橡皮擦|지우개
Airbrush|แอร์บรัช|Aérographe|Aerógrafo|Aerógrafo|Airbrush|エアブラシ|喷枪|에어브러시
Decoration|ตกแต่ง|Décoration|Decoración|Decoração|Dekoration|デコレーション|装饰|장식
Fill|เติมสี|Remplissage|Relleno|Preenchimento|Füllen|塗りつぶし|填充|채우기
Gradient|ไล่สี|Dégradé|Degradado|Gradiente|Verlauf|グラデーション|渐变|그라데이션
Eyedropper|ดูดสี|Pipette|Cuentagotas|Conta-gotas|Pipette|スポイト|吸管|스포이트
Selection|การเลือก|Sélection|Selección|Seleção|Auswahl|選択範囲|选区|선택 영역
Move / transform|ย้าย / แปลงรูป|Déplacer / transformer|Mover / transformar|Mover / transformar|Verschieben / transformieren|移動 / 変形|移动 / 变换|이동 / 변형
Figure|รูปทรง|Figure|Figura|Figura|Figur|図形|图形|도형
Ruler|ไม้บรรทัด|Règle|Regla|Régua|Lineal|定規|尺规|자
Balloon|บอลลูนคำพูด|Bulle|Bocadillo|Balão|Sprechblase|フキダシ|对话框|말풍선
Navigate|นำทาง|Naviguer|Navegar|Navegar|Navigieren|移動（表示）|导航|탐색
Blend tool|เครื่องมือผสมสี|Outil de mélange|Herramienta de mezcla|Ferramenta de mistura|Mischwerkzeug|色混ぜ|混色工具|혼합 도구
Vector|เวกเตอร์|Vectoriel|Vectorial|Vetorial|Vektor|ベクター|矢量|벡터
Liquify|ลิควิฟาย|Fluidité|Licuar|Liquefazer|Verflüssigen|ゆがみ|液化|픽셀 유동화
Manga tone|โทนมังงะ|Trame manga|Trama de manga|Retícula de mangá|Manga-Raster|マンガトーン|漫画网点|만화 톤
Shading pens|ปากกาแรเงา|Plumes d'ombrage|Plumas de sombreado|Canetas de sombreamento|Schattierstifte|陰影ペン|阴影笔|음영 펜
Bone|กระดูก|Os|Hueso|Osso|Knochen|ボーン|骨骼|뼈
Adjustment settings|ตั้งค่าเลเยอร์ปรับแต่ง|Réglages du calque de réglage|Ajustes de la capa de ajuste|Configurações da camada de ajuste|Einstellungen der Einstellungsebene|色調補正の設定|调整图层设置|보정 레이어 설정
Adjustment|ปรับแต่ง|Réglage|Ajuste|Ajuste|Einstellung|色調補正|调整|보정
Layer effects (border, shadow, glow)|เอฟเฟกต์เลเยอร์ (ขอบ เงา เรืองแสง)|Effets de calque (bordure, ombre, lueur)|Efectos de capa (borde, sombra, brillo)|Efeitos de camada (borda, sombra, brilho)|Ebeneneffekte (Rand, Schatten, Leuchten)|レイヤー効果（フチ、影、光彩）|图层效果（描边、阴影、发光）|레이어 효과 (테두리, 그림자, 광채)
Reference window (show / hide)|หน้าต่างภาพอ้างอิง (แสดง / ซ่อน)|Fenêtre de référence (afficher / masquer)|Ventana de referencia (mostrar / ocultar)|Janela de referência (mostrar / ocultar)|Referenzfenster (ein / aus)|資料ウィンドウ（表示 / 非表示）|参考窗口（显示 / 隐藏）|참고 창 (보이기 / 숨기기)
Reference|ภาพอ้างอิง|Référence|Referencia|Referência|Referenz|資料|参考|참고
Keyboard shortcuts (make your own)|ทางลัดแป้นพิมพ์ (ตั้งเอง)|Raccourcis clavier (personnalisés)|Atajos de teclado (personalizados)|Atalhos de teclado (personalizados)|Tastenkürzel (eigene)|キーボードショートカット（カスタム）|键盘快捷键（自定义）|키보드 단축키 (직접 설정)
Export pages (PDF / pictures)|ส่งออกหน้า (PDF / รูปภาพ)|Exporter les pages (PDF / images)|Exportar páginas (PDF / imágenes)|Exportar páginas (PDF / imagens)|Seiten exportieren (PDF / Bilder)|ページを書き出す（PDF / 画像）|导出页面（PDF / 图像）|페이지 내보내기 (PDF / 이미지)
Print|พิมพ์|Imprimer|Imprimir|Imprimir|Drucken|印刷|打印|인쇄
Export pages|ส่งออกหน้า|Exporter les pages|Exportar páginas|Exportar páginas|Seiten exportieren|ページを書き出す|导出页面|페이지 내보내기
Curve ruler|ไม้บรรทัดเส้นโค้ง|Règle courbe|Regla curva|Régua curva|Kurvenlineal|曲線定規|曲线尺|곡선 자
Concentric ruler|ไม้บรรทัดวงกลมซ้อน|Règle concentrique|Regla concéntrica|Régua concêntrica|Konzentrisches Lineal|同心円定規|同心圆尺|동심원 자
Camera (pan, zoom, rotate)|กล้อง (แพน ซูม หมุน)|Caméra (déplacer, zoomer, tourner)|Cámara (mover, zoom, girar)|Câmera (mover, zoom, girar)|Kamera (schwenken, zoomen, drehen)|カメラ（パン・ズーム・回転）|摄像机（平移、缩放、旋转）|카메라 (이동, 확대, 회전)
Camera key from what I see|คีย์กล้องจากมุมที่เห็นตอนนี้|Clé de caméra depuis la vue actuelle|Clave de cámara desde lo que veo|Chave de câmera do que estou vendo|Kamera-Schlüssel aus der Ansicht|今の表示からカメラキー|从当前视图创建摄像机关键帧|지금 보이는 대로 카메라 키
Camera|กล้อง|Caméra|Cámara|Câmera|Kamera|カメラ|摄像机|카메라
Edit text|แก้ไขข้อความ|Modifier le texte|Editar texto|Editar texto|Text bearbeiten|テキストを編集|编辑文字|텍스트 편집
Rasterize text (make it a picture)|แปลงข้อความเป็นภาพ|Pixelliser le texte (en faire une image)|Rasterizar texto (convertir en imagen)|Rasterizar texto (virar imagem)|Text rastern (in Bild umwandeln)|テキストをラスタライズ（画像にする）|栅格化文字（变为图像）|텍스트 래스터화 (그림으로)
Update text|อัปเดตข้อความ|Mettre à jour le texte|Actualizar texto|Atualizar texto|Text aktualisieren|テキストを更新|更新文字|텍스트 업데이트
Place text|วางข้อความ|Placer le texte|Colocar texto|Colocar texto|Text einfügen|テキストを配置|放置文字|텍스트 배치
Frame border|ขอบช่อง|Bord de case|Borde de viñeta|Borda de quadro|Panelrahmen|コマ枠|分格框|칸 테두리`;
