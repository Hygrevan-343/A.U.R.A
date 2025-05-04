import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'lucide-react-native';
import { Fingerprint, ScanLine, UserCheck, ClipboardCheck, CalendarCheck } from 'lucide-react-native';

import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  withDelay,
  Easing,
  interpolate
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';

const { width, height } = Dimensions.get('window');
const SPLASH_DURATION = 3000; // Exactly 3 seconds

export default function SplashScreen() {
  const router = useRouter();
  const lottieRef = useRef(null);
  const logoScale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const backgroundOpacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Calculate relative timings based on total duration
    const totalDuration = SPLASH_DURATION;
    const backgroundDuration = totalDuration * 0.25; // 25% of total time
    const logoDelay = totalDuration * 0.1; // 10% of total time
    const logoDuration = totalDuration * 0.4; // 40% of total time
    const titleDelay = totalDuration * 0.3; // 30% of total time
    const subtitleDelay = totalDuration * 0.4; // 40% of total time
    
    // Start animations
    backgroundOpacity.value = withTiming(1, { duration: backgroundDuration });
    logoScale.value = withDelay(logoDelay, withSpring(1, { damping: 10 }));
    opacity.value = withDelay(logoDelay, withTiming(1, { duration: logoDuration }));
    rotation.value = withDelay(logoDelay, withTiming(2 * Math.PI, { duration: logoDuration }));
    titleOpacity.value = withDelay(titleDelay, withTiming(1, { duration: backgroundDuration }));
    subtitleOpacity.value = withDelay(subtitleDelay, withTiming(1, { duration: backgroundDuration }));

    // Navigate after exactly 3 seconds
    const timer = setTimeout(() => {
      router.replace('/auth');
    }, SPLASH_DURATION);

    return () => clearTimeout(timer);
  }, []);

  // Rest of your component remains the same
  const logoAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: logoScale.value },
        { rotate: `${rotation.value}rad` }
      ],
      opacity: opacity.value,
    };
  });

  const titleAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: titleOpacity.value,
      transform: [
        { translateY: interpolate(titleOpacity.value, [0, 1], [20, 0]) }
      ],
    };
  });

  const subtitleAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: subtitleOpacity.value,
      transform: [
        { translateY: interpolate(subtitleOpacity.value, [0, 1], [20, 0]) }
      ],
    };
  });

  const backgroundStyle = useAnimatedStyle(() => {
    return {
      opacity: backgroundOpacity.value,
    };
  });

  return (
    <Animated.View style={[styles.container, backgroundStyle]}>
      <LinearGradient
        colors={['#4C51BF', '#6366F1']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.content}>
          <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <Fingerprint size={100} color="white" strokeWidth={1.5} />
          </Animated.View>
          
          <Animated.Text style={[styles.title, titleAnimatedStyle]}>
            AURA
          </Animated.Text>
          
          <Animated.Text style={[styles.subtitle, subtitleAnimatedStyle]}>
            Attendance System
          </Animated.Text>
          
          <View style={styles.lottieContainer}>
            <LottieView
              ref={lottieRef}
              source={require('@/assets/animations/loading-circle.json')}
              autoPlay
              loop={false}
              speed={0.8}
              duration={3000} // Set to match our total duration
              style={styles.lottie}
            />
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 52,
    color: 'white',
    marginTop: 20,
    letterSpacing: 4,  // Adds space between letters for premium look
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontFamily: 'Poppins-SemiBold',  // Changed from Regular to SemiBold
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    letterSpacing: 1.2,  // Slight letter spacing
  },
  lottieContainer: {
    marginTop: 40,
    height: 80,
  },
  lottie: {
    width: 100,
    height: 100,
  }
});