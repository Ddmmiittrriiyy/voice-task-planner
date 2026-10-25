package com.voicetasks.next

import android.content.*
import android.os.Build

class AlarmReceiver:BroadcastReceiver(){
    override fun onReceive(c:Context,i:Intent){
        val id=i.getStringExtra("id")?:""
        val text=i.getStringExtra("text")?:"Задача"

        AlarmStore.remove(c,id)
        AlarmStore.markTriggered(c,id)

        val serviceIntent=Intent(c,AlarmService::class.java).apply{
            action=AlarmService.ACTION_START
            putExtra(AlarmService.EXTRA_ID,id)
            putExtra(AlarmService.EXTRA_TEXT,text)
        }

        if(Build.VERSION.SDK_INT>=26) c.startForegroundService(serviceIntent)
        else c.startService(serviceIntent)
    }
}
