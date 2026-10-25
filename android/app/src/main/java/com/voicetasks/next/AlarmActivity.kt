package com.voicetasks.next

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.widget.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AlarmActivity:Activity(){
    override fun onCreate(b:Bundle?){
        super.onCreate(b)

        if(Build.VERSION.SDK_INT>=27){
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        window.addFlags(
            android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            android.view.WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        )

        val text=intent.getStringExtra(AlarmService.EXTRA_TEXT)?:"Задача"

        val box=LinearLayout(this).apply{
            orientation=LinearLayout.VERTICAL
            gravity=Gravity.CENTER
            setPadding(48,48,48,48)
            setBackgroundColor(Color.WHITE)
        }

        val time=TextView(this).apply{
            this.text=SimpleDateFormat("HH:mm",Locale.getDefault()).format(Date())
            textSize=48f
            setTextColor(Color.BLACK)
            gravity=Gravity.CENTER
        }

        val task=TextView(this).apply{
            this.text=text
            textSize=24f
            setTextColor(Color.BLACK)
            gravity=Gravity.CENTER
            setPadding(0,40,0,50)
        }

        val stop=Button(this).apply{
            this.text="ОТКЛЮЧИТЬ"
            setOnClickListener{
                stopService(Intent(this@AlarmActivity,AlarmService::class.java))
                finish()
            }
        }

        box.addView(time)
        box.addView(task)
        box.addView(stop)
        setContentView(box)
    }
}
