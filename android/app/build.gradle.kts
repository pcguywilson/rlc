plugins {
    id("com.android.application")
}

// The app uses the exact same content.js as the Chrome extension (repo root).
val rlcAssets = layout.buildDirectory.dir("generated/rlcAssets").get().asFile
val syncRlcScript by tasks.registering(Copy::class) {
    from(rootProject.file("../content.js"))
    into(rlcAssets)
}
tasks.named("preBuild") { dependsOn(syncRlcScript) }

android {
    namespace = "com.pcguywilson.rlc"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.pcguywilson.rlc"
        minSdk = 26
        targetSdk = 34
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.3.0"
    }

    sourceSets["main"].assets.srcDir(rlcAssets)

    // Fixed personal key so each CI build installs over the previous one.
    signingConfigs {
        create("release") {
            storeFile = file("release.keystore")
            storePassword = "rlcrelease"
            keyAlias = "rlc"
            keyPassword = "rlcrelease"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
