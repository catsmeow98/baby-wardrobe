package com.babywardrobe.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/** The app's screen. Registers the app's own native plugins before Capacitor starts. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SubjectSegmenterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
