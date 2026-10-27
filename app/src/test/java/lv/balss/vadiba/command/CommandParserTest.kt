package lv.balss.vadiba.command

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CommandParserTest {

    private fun parse(s: String) = CommandParser.parse(s)

    @Test
    fun everyHelpExampleIsUnderstood() {
        for (section in HelpContent.sections) {
            for (example in section.examples) {
                val command = parse(example)
                assertTrue("“$example” -> $command", command !is Command.Unknown)
            }
        }
    }

    @Test
    fun calls() {
        assertEquals(Command.Call("mammai"), parse("Piezvani mammai"))
        assertEquals(Command.Call("Jānim"), parse("lūdzu zvani Jānim"))
        assertEquals(Command.Call("26123456"), parse("zvani uz numuru 26 12 34 56"))
        assertEquals(Command.Call("+37126123456"), parse("Piezvani +371 26123456"))
        assertEquals(Command.Call("Pēterim Ozolam"), parse("Vai tu vari piezvanīt Pēterim Ozolam?"))
        assertEquals(Command.Call("mom"), parse("call mom"))
        assertEquals(Command.Call("mammai"), parse("piezvani mammai pa WhatsApp"))
        assertEquals(Command.AnswerCall, parse("Atbildi"))
        assertEquals(Command.EndCall, parse("noliec klausuli"))
    }

    @Test
    fun messages() {
        assertEquals(Command.SendMessage(Messenger.SMS, "Jānim", "kavēšos"), parse("Sūti īsziņu Jānim, ka kavēšos"))
        assertEquals(Command.SendMessage(Messenger.SMS, "Jānim", "kavēšos 10 minūtes"), parse("Sūti Jānim, ka kavēšos 10 minūtes"))
        assertEquals(Command.SendMessage(Messenger.WHATSAPP, "Annai sveika", null), parse("Sūti WhatsApp Annai sveika"))
        assertEquals(Command.SendMessage(Messenger.WHATSAPP, "mammai", "būšu mājās"), parse("WhatsApp mammai: būšu mājās"))
        assertEquals(Command.SendMessage(Messenger.WHATSAPP, "tētim", "nāc ēst"), parse("uzraksti WhatsApp ziņu tētim ka nāc ēst"))
        assertEquals(Command.SendMessage(Messenger.SMS, "26123456", "kavēšos"), parse("sūti sms 26123456 kavēšos"))
        assertEquals(Command.SendMessage(Messenger.SMS, "mom", "I am late"), parse("send a text to mom saying I am late"))
        assertEquals(Command.SendMessage(Messenger.SMS, "", null), parse("sūti īsziņu"))
    }

    @Test
    fun apps() {
        assertEquals(Command.OpenApp("WhatsApp"), parse("Atver WhatsApp"))
        assertEquals(Command.OpenApp("Spotify"), parse("palaid lietotni Spotify"))
        assertEquals(Command.OpenApp("kalkulatoru"), parse("atver kalkulatoru"))
        assertEquals(Command.OpenApp("YouTube"), parse("atver YouTube"))
        assertEquals(Command.Unknown("WhatsApp"), parse("WhatsApp"))
        assertEquals(Command.Camera(CameraMode.PHOTO), parse("atver kameru"))
        assertEquals(Command.Camera(CameraMode.VIDEO), parse("ieraksti video"))
        assertEquals(Command.Camera(CameraMode.SELFIE), parse("uzņem selfiju"))
    }

    @Test
    fun screen() {
        assertEquals(Command.Global(GlobalAction.BACK), parse("atpakaļ"))
        assertEquals(Command.Global(GlobalAction.BACK), parse("Ej atpakaļ, lūdzu"))
        assertEquals(Command.Global(GlobalAction.HOME), parse("uz sākumu"))
        assertEquals(Command.Global(GlobalAction.HOME), parse("spied sākums"))
        assertEquals(Command.Global(GlobalAction.LOCK_SCREEN), parse("izslēdz ekrānu"))
        assertEquals(Command.Scroll(Direction.DOWN), parse("Ritini uz leju"))
        assertEquals(Command.Scroll(Direction.UP), parse("scroll up"))
        assertEquals(Command.Tap("Iestatījumi"), parse("Spied Iestatījumi"))
        assertEquals(Command.Tap("sūtīt"), parse("nospied pogu sūtīt"))
        assertEquals(Command.TypeText("sveiks, kā iet?"), parse("Raksti sveiks, kā iet?"))
    }

    @Test
    fun phoneSettings() {
        assertEquals(Command.Flashlight(true), parse("Ieslēdz lukturīti"))
        assertEquals(Command.Flashlight(false), parse("izslēdz lukturi"))
        assertEquals(Command.Flashlight(null), parse("lukturītis"))
        assertEquals(Command.Flashlight(true), parse("turn on the flashlight"))
        assertEquals(Command.Volume(Level.UP), parse("skaļāk"))
        assertEquals(Command.Volume(Level.DOWN), parse("vēl klusāk"))
        assertEquals(Command.Volume(Level.SET, 50), parse("Skaļums 50 procenti"))
        assertEquals(Command.Volume(Level.SET, 30), parse("uzliec skaļumu uz 3"))
        assertEquals(Command.Volume(Level.MAX, 100), parse("maksimālais skaļums"))
        assertEquals(Command.Volume(Level.MUTE), parse("izslēdz skaņu"))
        assertEquals(Command.Ringer(RingerMode.SILENT), parse("klusais režīms"))
        assertEquals(Command.Ringer(RingerMode.VIBRATE), parse("ieslēdz vibrāciju"))
        assertEquals(Command.Ringer(RingerMode.NORMAL), parse("izslēdz klusais režīms"))
        assertEquals(Command.Ringer(RingerMode.SILENT), parse("ieslēdz kluso režīmu"))
        assertEquals(Command.Ringer(RingerMode.NORMAL), parse("ieslēdz zvana režīmu"))
        assertEquals(Command.OpenSettings(SettingsPanel.DISPLAY), parse("ieslēdz tumšo režīmu"))
        assertEquals(Command.DoNotDisturb(true), parse("ieslēdz netraucēt režīmu"))
        assertEquals(Command.DoNotDisturb(false), parse("izslēdz netraucēt"))
        assertEquals(Command.Brightness(Level.SET, 70), parse("Spilgtums 70"))
        assertEquals(Command.Brightness(Level.UP), parse("gaišāk"))
        assertEquals(Command.Brightness(Level.AUTO), parse("automātisks spilgtums"))
        assertEquals(Command.OpenSettings(SettingsPanel.WIFI), parse("Atver Wi-Fi"))
        assertEquals(Command.OpenSettings(SettingsPanel.WIFI), parse("ieslēdz wifi"))
        assertEquals(Command.OpenSettings(SettingsPanel.BLUETOOTH), parse("Bluetooth"))
        assertEquals(Command.OpenSettings(SettingsPanel.MOBILE_DATA), parse("ieslēdz mobilos datus"))
        assertEquals(Command.OpenSettings(SettingsPanel.MAIN), parse("atver iestatījumus"))
        assertEquals(Command.OpenSettings(SettingsPanel.DISPLAY), parse("tumšais režīms"))
    }

    @Test
    fun timeAndAlarms() {
        assertEquals(Command.TellTime, parse("Cik pulkstenis?"))
        assertEquals(Command.TellTime, parse("what time is it"))
        assertEquals(Command.TellDate, parse("Kāds šodien datums?"))
        assertEquals(Command.TellDate, parse("kāda šodien diena"))
        assertEquals(Command.TellBattery, parse("cik ir baterija"))
        assertEquals(Command.Alarm(7, 30), parse("Uzliec modinātāju uz 7:30"))
        assertEquals(Command.Alarm(7, 30), parse("Pamodini mani pusastoņos"))
        assertEquals(Command.Alarm(6, 0), parse("modinātājs sešos no rīta"))
        assertEquals(Command.Alarm(19, 15), parse("modinātājs septiņos piecpadsmit vakarā"))
        assertEquals(Command.Alarm(21, 0), parse("set an alarm for 9 pm"))
        assertEquals(Command.Alarm(null), parse("atver modinātāju"))
        assertEquals(Command.Timer(300), parse("Taimeris 5 minūtes"))
        assertEquals(Command.Timer(1800), parse("uzliec taimeri uz pusstundu"))
        assertEquals(Command.Timer(5400), parse("taimeris 1 stunda un 30 minūtes"))
        assertEquals(Command.Timer(25 * 60), parse("taimeris uz divdesmit piecām minūtēm"))
        assertEquals(Command.Timer(90), parse("taimeris pusotru minūti"))
        assertEquals(Command.Timer(1200), parse("Atgādini man pēc 20 minūtēm"))
        assertEquals(Command.Timer(600), parse("pamodini mani pēc desmit minūtēm"))
        assertEquals(Command.Timer(null), parse("taimeris"))
    }

    @Test
    fun internetMapsMusic() {
        assertEquals(Command.WebSearch("picērijas Rīgā"), parse("Meklē picērijas Rīgā"))
        assertEquals(Command.WebSearch("receptes"), parse("pameklē internetā receptes"))
        assertEquals(Command.WebSearch("Kas ir Rīgas Doms?"), parse("Kas ir Rīgas Doms?"))
        assertEquals(Command.WebSearch("Kāds laiks rīt?"), parse("Kāds laiks rīt?"))
        assertEquals(Command.YouTubeSearch("kaķi"), parse("Meklē YouTube kaķi"))
        assertEquals(Command.YouTubeSearch("kaķi"), parse("meklē kaķi YouTubē"))
        assertEquals(Command.YouTubeSearch("Prāta Vētra"), parse("atskaņo YouTube Prāta Vētra"))
        assertEquals(Command.Navigate("Brīvības iela 1, Rīga"), parse("Navigē uz Brīvības iela 1, Rīga"))
        assertEquals(Command.Navigate("darbu"), parse("aizved mani uz darbu"))
        assertEquals(Command.ShowMap("Siguldu"), parse("Parādi kartē Siguldu"))
        assertEquals(Command.PlayMusic("Prāta Vētra"), parse("Atskaņo Prāta Vētra"))
        assertEquals(Command.PlayMusic("Queen"), parse("atskaņo dziesmu Queen"))
        assertEquals(Command.Media(MediaAction.PAUSE), parse("Pauze"))
        assertEquals(Command.Media(MediaAction.NEXT), parse("nākamā dziesma"))
        assertEquals(Command.Media(MediaAction.PLAY), parse("turpini"))
    }

    @Test
    fun controlWords() {
        assertEquals(Command.Help, parse("palīdzība"))
        assertEquals(Command.Stop, parse("beidz"))
        assertEquals(Command.Stop, parse("paldies"))
        assertTrue(parse("") is Command.Unknown)
        assertTrue(parse("zils debess") is Command.Unknown)
    }

    @Test
    fun bestAlternativeWins() {
        val (text, command) = CommandParser.parseBest(listOf("zils lukturis debesīs bla", "ieslēdz lukturīti"))
        assertNotEquals(Command.Unknown(text), command)
        val (_, flashlight) = CommandParser.parseBest(listOf("kaut kas nesaprotams", "ieslēdz lukturīti"))
        assertEquals(Command.Flashlight(true), flashlight)
    }
}
