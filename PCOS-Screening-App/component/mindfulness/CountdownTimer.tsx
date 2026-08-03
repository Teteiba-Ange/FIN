// components/CountdownTimer.tsx

import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
} from "react-native";

import ProgressBar from "./ProgressBar";



interface CountdownTimerProps {

  minutes?: number;

}



export default function CountdownTimer({

  minutes = 10,

}: CountdownTimerProps) {


  const totalSeconds = minutes * 60;


  const [secondsLeft, setSecondsLeft] =
    useState(totalSeconds);



  useEffect(() => {


    const timer = setInterval(() => {


      setSecondsLeft((previous) => {


        if(previous <= 0){

          clearInterval(timer);

          return 0;

        }


        return previous - 1;


      });


    },1000);



    return () => clearInterval(timer);


  },[]);



  const minutesLeft =
    Math.floor(secondsLeft / 60);


  const seconds =
    secondsLeft % 60;



  const progress =
    ((totalSeconds - secondsLeft) /
      totalSeconds) * 100;



  return (

    <View style={styles.card}>


      <Text style={styles.heading}>
        🧘 Mindfulness Session
      </Text>



      <Text style={styles.timer}>

        {String(minutesLeft).padStart(2,"0")}:
        {String(seconds).padStart(2,"0")}

      </Text>



      <ProgressBar
        progress={progress}
        color="#1f7a7a"
        height={12}
      />



      <Text style={styles.description}>
        Stay focused and complete your relaxation exercise
      </Text>


    </View>

  );

}




const styles = StyleSheet.create({

  card: {

    backgroundColor:"#ffffff",

    borderRadius:20,

    padding:20,

    marginBottom:20,

    elevation:3,

    shadowColor:"#000",

    shadowOpacity:0.08,

    shadowRadius:5,

  },


  heading:{

    textAlign:"center",

    fontSize:16,

    fontWeight:"800",

    color:"#114a4a",

    marginBottom:15,

  },


  timer:{

    textAlign:"center",

    fontSize:42,

    fontWeight:"900",

    color:"#1f7a7a",

    marginBottom:20,

    letterSpacing:3,

  },


  description:{

    marginTop:12,

    textAlign:"center",

    fontSize:12,

    color:"#64748b",

  },


});