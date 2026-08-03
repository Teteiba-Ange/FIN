// components/ProgressBar.tsx

import React, { useEffect, useRef } from "react";
import {
  View,
  Animated,
  StyleSheet,
} from "react-native";


interface ProgressBarProps {
  progress: number; // value from 0 - 100
  color?: string;
  height?: number;
}


export default function ProgressBar({
  progress,
  color = "#1f7a7a",
  height = 10,
}: ProgressBarProps) {

  const animation = useRef(
    new Animated.Value(0)
  ).current;


  useEffect(() => {

    Animated.timing(animation, {
      toValue: Math.min(progress, 100),
      duration: 800,
      useNativeDriver: false,
    }).start();

  }, [progress]);



  const animatedWidth = animation.interpolate({

    inputRange: [0, 100],

    outputRange: [
      "0%",
      "100%",
    ],

  });



  return (

    <View
      style={[
        styles.background,
        {
          height,
          borderRadius: height / 2,
        },
      ]}
    >

      <Animated.View
        style={[
          styles.fill,
          {
            width: animatedWidth,
            backgroundColor: color,
            height,
            borderRadius: height / 2,
          },
        ]}
      />

    </View>

  );
}



const styles = StyleSheet.create({

  background: {
    width: "100%",
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },


  fill: {
    position: "absolute",
    left: 0,
    top: 0,
  },

});
