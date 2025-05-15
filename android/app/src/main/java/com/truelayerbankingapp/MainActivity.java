package com.truelayerbankingapp;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

public class MainActivity extends ReactActivity {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  @Override
  protected String getMainComponentName() {
    return "TrueLayerBankingApp";
  }

  /**
   * Returns the instance of the {@link ReactActivityDelegate}. We use {@link DefaultReactActivityDelegate}
   * which allows you to enable New Architecture with a single boolean flag {@link DefaultNewArchitectureEntryPoint}
   */
  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new DefaultReactActivityDelegate(
      this,
      getMainComponentName(),
      DefaultNewArchitectureEntryPoint.getFabricEnabled()
    );
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    // Handle deep links
    Uri uri = intent.getData();
    if (uri != null) {
      // React Native will handle the URI via Linking
    }
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Handle deep links on initial app launch
    Intent intent = getIntent();
    Uri uri = intent.getData();
    if (uri != null) {
      // React Native will handle the URI via Linking
    }
  }
}