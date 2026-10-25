package com.voicetasks.next

import android.app.*
import android.content.*
import android.os.Build

object AlarmScheduler {
    fun schedule(c:Context,a:StoredAlarm){
        val am=c.getSystemService(AlarmManager::class.java)
        val pi=PendingIntent.getBroadcast(c,a.id.hashCode(),Intent(c,AlarmReceiver::class.java).putExtra("id",a.id).putExtra("text",a.text),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        AlarmStore.put(c,a)
        if(Build.VERSION.SDK_INT>=31 && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,a.at,pi)
        else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,a.at,pi)
    }
    fun cancel(c:Context,id:String){
        val am=c.getSystemService(AlarmManager::class.java)
        val pi=PendingIntent.getBroadcast(c,id.hashCode(),Intent(c,AlarmReceiver::class.java),PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)
        if(pi!=null) am.cancel(pi)
        AlarmStore.remove(c,id)
    }
}
