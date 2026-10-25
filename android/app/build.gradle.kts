plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.voicetasks.next"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.voicetasks.two"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "2.0.0-dev1"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}


dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
