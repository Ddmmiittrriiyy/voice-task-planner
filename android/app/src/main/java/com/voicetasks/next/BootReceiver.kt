package com.voicetasks.next

import android.content.*

class BootReceiver:BroadcastReceiver(){
    override fun onReceive(c:Context,i:Intent){
        if(i.action==Intent.ACTION_BOOT_COMPLETED){
            val now=System.currentTimeMillis()
            AlarmStore.all(c).forEach { if(it.at>now) AlarmScheduler.schedule(c,it) else AlarmStore.remove(c,it.id) }
        }
    }
}
