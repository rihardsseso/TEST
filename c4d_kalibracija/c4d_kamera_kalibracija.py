"""
Cinema 4D kameras kalibrācija foto "maja.jpg" (1581 x 1186 px).

Palaid: Extensions > Script Manager > ielīmē > Execute
(vai caur Cinema 4D MCP "execute python" rīku).

Kalibrācija iegūta no 2 izzušanas punktiem:
  VP1 (gar sienu, pa kreisi)      = (-824, 596) px
  VP2 (perpendikulāri, pa labi)   = (1395, 596) px
  -> fokusa attālums 988 px = 22.5 mm uz 36 mm sensora (HFOV ~77 grādi)
  -> horizonts gandrīz attēla centrā => pitch ~0, bank 0
Mērogs: pieņemts, ka kamera ir 160 cm augstumā (pārbaude: logs sanāk ~124 cm augsts).

Pasaules koordinātas (cm, Y uz augšu):
  Y = 0   -> zeme
  Z = 0   -> mājas garās sienas plakne (siena iet pa X asi, skatās uz -Z)
  X = 0   -> sienas punkts attēla centra kolonnā
"""
import os
import c4d
from c4d import utils

# ---- iestatījumi -----------------------------------------------------------
IMAGE_PATH = ""            # tukšs = meklē maja.jpg blakus skriptam vai prasa failu
IMG_W, IMG_H = 1581, 1186
SENSOR_MM = 36.0
FOCAL_MM = 22.491          # 987.73 px * 36 / 1581
CAM_POS = c4d.Vector(0.0, 160.0, -795.38)
# kameras asis pasaulē (aprēķinātas no izzušanas punktiem)
CAM_X = c4d.Vector(0.852963, 0.0, 0.521971)     # pa labi
CAM_Y = c4d.Vector(0.001660, 0.999995, -0.002713)  # uz augšu
CAM_Z = c4d.Vector(-0.521968, 0.003181, 0.852959)  # skata virziens
ADD_HELPERS = True         # sienas un zemes palīgplaknes pārbaudei
# ---------------------------------------------------------------------------


def find_image(doc):
    if IMAGE_PATH and os.path.isfile(IMAGE_PATH):
        return IMAGE_PATH
    cands = []
    try:
        cands.append(os.path.join(os.path.dirname(__file__), "maja.jpg"))
    except NameError:
        pass
    if doc.GetDocumentPath():
        cands.append(os.path.join(doc.GetDocumentPath(), "maja.jpg"))
    for p in cands:
        if os.path.isfile(p):
            return p
    return c4d.storage.LoadDialog(c4d.FILESELECTTYPE_IMAGES, "Izvēlies foto (maja.jpg)")


def make_plane(name, w, h, axis, pos, color):
    pl = c4d.BaseObject(c4d.Oplane)
    pl.SetName(name)
    pl[c4d.PRIM_PLANE_WIDTH] = w
    pl[c4d.PRIM_PLANE_HEIGHT] = h
    pl[c4d.PRIM_PLANE_SUBW] = int(w / 100)
    pl[c4d.PRIM_PLANE_SUBH] = int(h / 100)
    pl[c4d.PRIM_AXIS] = axis
    pl.SetAbsPos(pos)
    pl[c4d.ID_BASEOBJECT_USECOLOR] = c4d.ID_BASEOBJECT_USECOLOR_ALWAYS
    pl[c4d.ID_BASEOBJECT_COLOR] = color
    pl[c4d.ID_BASEOBJECT_XRAY] = True
    disp = pl.MakeTag(c4d.Tdisplay)
    disp[c4d.DISPLAYTAG_AFFECT_DISPLAYMODE] = True
    disp[c4d.DISPLAYTAG_SDISPLAYMODE] = c4d.DISPLAYTAG_SDISPLAY_NOSHADING
    disp[c4d.DISPLAYTAG_WDISPLAYMODE] = c4d.DISPLAYTAG_WDISPLAY_WIREFRAME
    return pl


def main():
    doc = c4d.documents.GetActiveDocument()
    doc.StartUndo()

    # --- renderēšanas izšķirtspēja = foto izmērs
    rd = doc.GetActiveRenderData()
    rd[c4d.RDATA_LOCKRATIO] = False
    rd[c4d.RDATA_XRES] = float(IMG_W)
    rd[c4d.RDATA_YRES] = float(IMG_H)
    rd[c4d.RDATA_FILMASPECT] = IMG_W / float(IMG_H)
    rd[c4d.RDATA_PIXELASPECT] = 1.0

    # --- kamera
    cam = c4d.CameraObject()
    cam.SetName("Kalibreta_kamera")
    cam[c4d.CAMERAOBJECT_APERTURE] = SENSOR_MM
    cam[c4d.CAMERA_FOCUS] = FOCAL_MM
    cam[c4d.CAMERAOBJECT_FILM_OFFSET_X] = 0.0
    cam[c4d.CAMERAOBJECT_FILM_OFFSET_Y] = 0.0
    m = c4d.Matrix(CAM_POS, CAM_X.GetNormalized(), CAM_Y.GetNormalized(), CAM_Z.GetNormalized())
    cam.SetMg(m)
    cam.MakeTag(c4d.Tprotection)  # lai nejauši nepakustinātu
    doc.InsertObject(cam)
    doc.AddUndo(c4d.UNDOTYPE_NEW, cam)

    # --- foto kā fons (Background objekts + luminance materiāls)
    path = find_image(doc)
    if path:
        mat = c4d.BaseMaterial(c4d.Mmaterial)
        mat.SetName("Foto_fons")
        mat[c4d.MATERIAL_USE_COLOR] = False
        mat[c4d.MATERIAL_USE_REFLECTION] = False
        mat[c4d.MATERIAL_USE_LUMINANCE] = True
        sh = c4d.BaseShader(c4d.Xbitmap)
        sh[c4d.BITMAPSHADER_FILENAME] = path
        mat[c4d.MATERIAL_LUMINANCE_SHADER] = sh
        mat.InsertShader(sh)
        doc.InsertMaterial(mat)
        doc.AddUndo(c4d.UNDOTYPE_NEW, mat)

        bg = c4d.BaseObject(c4d.Obackground)
        bg.SetName("Foto_fons")
        tt = bg.MakeTag(c4d.Ttexture)
        tt[c4d.TEXTURETAG_MATERIAL] = mat
        tt[c4d.TEXTURETAG_PROJECTION] = c4d.TEXTURETAG_PROJECTION_FRONTAL
        doc.InsertObject(bg)
        doc.AddUndo(c4d.UNDOTYPE_NEW, bg)

        # arī skatloga fonā (Camera Calibrator taga attēls)
        try:
            ctag = cam.MakeTag(1029524)  # Camera Calibrator tag
            if ctag:
                ctag[c4d.CALIBRATETAG_IMAGE] = path
        except Exception:
            pass

    # --- palīgplaknes: siena (Z=0) un zeme (Y=0)
    if ADD_HELPERS:
        null = c4d.BaseObject(c4d.Onull)
        null.SetName("Kalibracijas_palig")
        wall = make_plane("Siena_Z0", 2600, 450, c4d.PRIM_AXIS_ZN,
                          c4d.Vector(-250, 225, 0), c4d.Vector(0, 1, 1))
        ground = make_plane("Zeme_Y0", 2600, 800, c4d.PRIM_AXIS_YP,
                            c4d.Vector(-250, 0, -400), c4d.Vector(1, 0, 1))
        wall.InsertUnder(null)
        ground.InsertUnder(null)
        doc.InsertObject(null)
        doc.AddUndo(c4d.UNDOTYPE_NEW, null)

    # --- aktīvā skatloga kamera
    bd = doc.GetActiveBaseDraw()
    if bd:
        bd.SetSceneCamera(cam)

    doc.EndUndo()
    c4d.EventAdd()
    hpb = utils.MatrixToHPB(m)
    print("Kamera izveidota. H/P/B = %.2f / %.2f / %.2f grādi, fokuss %.2f mm"
          % (utils.RadToDeg(hpb.x), utils.RadToDeg(hpb.y), utils.RadToDeg(hpb.z), FOCAL_MM))


if __name__ == "__main__":
    main()
