package com.voicetasks.next

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.*

class AlarmService:Service(){
    companion object{
        const val ACTION_START="com.voicetasks.next.ALARM_START"
        const val ACTION_STOP="com.voicetasks.next.ALARM_STOP"
        const val EXTRA_ID="id"
        const val EXTRA_TEXT="text"
        private const val CHANNEL_ID="voice_tasks_alarm"
        private const val NOTIFICATION_ID=7101
    }

    private var player:MediaPlayer?=null
    private var vibrator:Vibrator?=null
    private var wakeLock:PowerManager.WakeLock?=null

    override fun onCreate(){
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int{
        when(intent?.action){
            ACTION_STOP -> {
                stopAlarm()
                return START_NOT_STICKY
            }
        }

        val id=intent?.getStringExtra(EXTRA_ID)?:""
        val text=intent?.getStringExtra(EXTRA_TEXT)?:"Задача"

        acquireWakeLock()
        startForeground(NOTIFICATION_ID,buildAlarmNotification(id,text))
        startAlarmSound()
        startVibration()

        return START_NOT_STICKY
    }

    private fun acquireWakeLock(){
        if(wakeLock?.isHeld==true) return
        val pm=getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock=pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"VoiceTasks:AlarmWakeLock").apply{
            setReferenceCounted(false)
            acquire(10*60*1000L)
        }
    }

    private fun buildAlarmNotification(id:String,text:String):Notification{
        val fullScreenIntent=Intent(this,AlarmActivity::class.java).apply{
            putExtra(EXTRA_ID,id)
            putExtra(EXTRA_TEXT,text)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val fullScreenPending=PendingIntent.getActivity(
            this,id.hashCode(),fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent=Intent(this,AlarmService::class.java).apply{ action=ACTION_STOP }
        val stopPending=PendingIntent.getService(
            this,id.hashCode()+1,stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return Notification.Builder(this,CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Voice Tasks")
            .setContentText(text)
            .setCategory(Notification.CATEGORY_ALARM)
            .setPriority(Notification.PRIORITY_MAX)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(fullScreenPending)
            .setFullScreenIntent(fullScreenPending,true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel,"ОТКЛЮЧИТЬ",stopPending)
            .build()
    }

    private fun createNotificationChannel(){
        if(Build.VERSION.SDK_INT>=26){
            val nm=getSystemService(NotificationManager::class.java)
            val channel=NotificationChannel(
                CHANNEL_ID,
                "Будильники Voice Tasks",
                NotificationManager.IMPORTANCE_HIGH
            ).apply{
                description="Точные будильники задач"
                lockscreenVisibility=Notification.VISIBILITY_PUBLIC
                setSound(null,null)
                enableVibration(false)
                setBypassDnd(true)
            }
            nm.createNotificationChannel(channel)
        }
    }

    private fun startAlarmSound(){
        if(player?.isPlaying==true) return
        val uri=RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        try{
            player=MediaPlayer().apply{
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@AlarmService,uri)
                isLooping=true
                prepare()
                start()
            }
        }catch(_:Exception){
            player?.release()
            player=null
        }
    }

    private fun startVibration(){
        if(vibrator?.hasVibrator()==true) return
        vibrator=if(Build.VERSION.SDK_INT>=31){
            getSystemService(VibratorManager::class.java).defaultVibrator
        }else{
            @Suppress("DEPRECATION")
            getSystemService(VIBRATOR_SERVICE) as Vibrator
        }

        val pattern=longArrayOf(0,700,450,700,450)
        if(Build.VERSION.SDK_INT>=26){
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern,0))
        }else{
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern,0)
        }
    }

    private fun stopAlarm(){
        vibrator?.cancel()
        vibrator=null
        try{ player?.stop() }catch(_:Exception){}
        player?.release()
        player=null
        if(wakeLock?.isHeld==true) wakeLock?.release()
        wakeLock=null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy(){
        stopAlarm()
        super.onDestroy()
    }

    override fun onBind(intent:Intent?)=null
}
