# libwg-go.so calls into these classes by their exact names (JNI), so R8 must not rename or remove them.
-keep class com.wireguard.** { *; }
-keep class expo.modules.zeppelinvpn.** { *; }

# The tunnel library annotates with JSR-305 types that are compile-only.
-dontwarn javax.annotation.**
