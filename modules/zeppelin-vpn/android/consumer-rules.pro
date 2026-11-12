# libwg-go.so calls into these classes by their exact names (JNI), so R8 must not rename or remove them.
-keep class com.wireguard.** { *; }
-keep class expo.modules.zeppelinvpn.** { *; }

# The tunnel library annotates with JSR-305 types that are compile-only.
-dontwarn javax.annotation.**

# InMobi ads SDK (2.4.0)
-keep class com.inmobi.** { *; }
-dontwarn com.inmobi.**
-keep class com.squareup.picasso.** { *; }
-dontwarn com.squareup.picasso.**
-keep class com.google.android.gms.ads.identifier.AdvertisingIdClient { public *; }
-keep class com.google.android.gms.ads.identifier.AdvertisingIdClient$Info { public *; }
