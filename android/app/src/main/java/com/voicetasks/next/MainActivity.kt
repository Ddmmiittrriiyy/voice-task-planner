package com.voicetasks.next

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import org.json.JSONObject
import java.util.Locale

class MainActivity:Activity(){
    companion object{
        private const val REQ_AUDIO=100
        private const val REQ_IMPORT=2001
        private const val REQ_EXPORT=2002
        private const val REQ_VOICE_FALLBACK=2003
    }

    private lateinit var web:WebView
    private var speechRecognizer:SpeechRecognizer?=null
    private var pendingVoiceLanguage:String?=null
    private var pendingExportJson:String?=null

    override fun onCreate(b:Bundle?){
        super.onCreate(b)
        web=WebView(this)
        setContentView(web)

        web.settings.javaScriptEnabled=true
        web.settings.domStorageEnabled=true
        web.settings.mediaPlaybackRequiresUserGesture=false
        web.webViewClient=WebViewClient()
        web.addJavascriptInterface(AndroidBridge(this),"AndroidBridge")

        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),REQ_AUDIO)
        }

        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS),101)
        }

        web.loadUrl("https://ddmmiittrriiyy.github.io/Voice-Tasks/")
    }

    fun startVoiceRecognition(language:String){
        runOnUiThread{
            if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
                pendingVoiceLanguage=language
                requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),REQ_AUDIO)
                return@runOnUiThread
            }
            startVoiceRecognitionGranted(language)
        }
    }

    private fun startVoiceRecognitionGranted(language:String){
        if(!SpeechRecognizer.isRecognitionAvailable(this)){
            startVoiceFallback(language)
            return
        }

        if(speechRecognizer==null){
            speechRecognizer=SpeechRecognizer.createSpeechRecognizer(this)
            speechRecognizer?.setRecognitionListener(object:RecognitionListener{
                override fun onReadyForSpeech(params:Bundle?){}
                override fun onBeginningOfSpeech(){}
                override fun onRmsChanged(rmsdB:Float){}
                override fun onBufferReceived(buffer:ByteArray?){}
                override fun onEndOfSpeech(){}
                override fun onError(error:Int){
                    if(error==SpeechRecognizer.ERROR_CLIENT ||
                       error==SpeechRecognizer.ERROR_SERVER ||
                       error==SpeechRecognizer.ERROR_SERVER_DISCONNECTED){
                        startVoiceFallback(pendingVoiceLanguage ?: Locale.getDefault().toLanguageTag())
                    }else{
                        sendVoiceError(error)
                    }
                }
                override fun onResults(results:Bundle?){
                    val text=results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                    if(text.isNullOrBlank()) sendVoiceError(0) else sendVoiceResult(text)
                }
                override fun onPartialResults(partialResults:Bundle?){}
                override fun onEvent(eventType:Int,params:Bundle?){}
            })
        }

        pendingVoiceLanguage=language

        val intent=Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply{
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE,language)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE,language)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,false)
        }

        try{
            speechRecognizer?.cancel()
            speechRecognizer?.startListening(intent)
        }catch(_:Exception){
            startVoiceFallback(language)
        }
    }

    private fun startVoiceFallback(language:String){
        pendingVoiceLanguage=language
        val intent=Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply{
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE,language)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE,language)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1)
            putExtra(RecognizerIntent.EXTRA_PROMPT,"Говорите")
        }
        try{
            startActivityForResult(intent,REQ_VOICE_FALLBACK)
        }catch(_:ActivityNotFoundException){
            sendVoiceError(-1)
        }catch(_:Exception){
            sendVoiceError(-2)
        }
    }

    private fun sendVoiceResult(text:String){
        pendingVoiceLanguage=null
        val js="window.startVoiceResult && window.startVoiceResult("+JSONObject.quote(text)+");"
        runOnUiThread{ web.evaluateJavascript(js,null) }
    }

    private fun sendVoiceError(code:Int){
        pendingVoiceLanguage=null
        runOnUiThread{ web.evaluateJavascript("window.startVoiceError && window.startVoiceError("+code+");",null) }
    }

    fun exportTasks(json:String,filename:String){
        runOnUiThread{
            pendingExportJson=json
            val intent=Intent(Intent.ACTION_CREATE_DOCUMENT).apply{
                addCategory(Intent.CATEGORY_OPENABLE)
                type="application/json"
                putExtra(Intent.EXTRA_TITLE,filename)
            }
            startActivityForResult(intent,REQ_EXPORT)
        }
    }

    fun importTasks(){
        runOnUiThread{
            val intent=Intent(Intent.ACTION_OPEN_DOCUMENT).apply{
                addCategory(Intent.CATEGORY_OPENABLE)
                type="application/json"
            }
            startActivityForResult(intent,REQ_IMPORT)
        }
    }

    override fun onActivityResult(requestCode:Int,resultCode:Int,data:Intent?){
        super.onActivityResult(requestCode,resultCode,data)

        if(requestCode==REQ_VOICE_FALLBACK){
            if(resultCode==RESULT_OK){
                val text=data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
                if(text.isNullOrBlank()) sendVoiceError(0) else sendVoiceResult(text)
            }else{
                sendVoiceError(-4)
            }
            return
        }

        if(resultCode!=RESULT_OK) return
        val uri=data?.data ?: return

        when(requestCode){
            REQ_EXPORT -> {
                try{
                    contentResolver.openOutputStream(uri)?.use{
                        it.write((pendingExportJson?:"[]").toByteArray(Charsets.UTF_8))
                    }
                    Toast.makeText(this,"Экспорт сохранён",Toast.LENGTH_SHORT).show()
                }catch(_:Exception){
                    Toast.makeText(this,"Не удалось сохранить экспорт",Toast.LENGTH_SHORT).show()
                }finally{
                    pendingExportJson=null
                }
            }
            REQ_IMPORT -> {
                try{
                    val json=contentResolver.openInputStream(uri)?.bufferedReader()?.use{it.readText()} ?: return
                    val js="window.voiceTasksImportJson && window.voiceTasksImportJson("+JSONObject.quote(json)+");"
                    web.evaluateJavascript(js,null)
                }catch(_:Exception){
                    Toast.makeText(this,"Не удалось прочитать файл",Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode:Int,permissions:Array<out String>,grantResults:IntArray){
        super.onRequestPermissionsResult(requestCode,permissions,grantResults)
        if(requestCode==REQ_AUDIO){
            if(grantResults.isNotEmpty() && grantResults[0]==PackageManager.PERMISSION_GRANTED){
                val lang=pendingVoiceLanguage ?: Locale.getDefault().toLanguageTag()
                pendingVoiceLanguage=null
                startVoiceRecognitionGranted(lang)
            }else{
                pendingVoiceLanguage=null
                sendVoiceError(-3)
            }
        }
    }

    override fun onDestroy(){
        speechRecognizer?.destroy()
        speechRecognizer=null
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed(){
        if(web.canGoBack()) web.goBack() else super.onBackPressed()
    }
}
