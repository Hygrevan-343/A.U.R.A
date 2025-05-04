// app/(tabs)/settings.tsx
import { View, Text, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { Bell, ChevronRight, Lock, LogOut, Moon, User } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useTheme();

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Logout", 
          onPress: () => logout(),
          style: "destructive"
        }
      ]
    );
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <Text style={[styles.title, isDarkMode && styles.titleDark]}>Settings</Text>
        {user && <Text style={styles.welcomeText}>Welcome, {user.name}</Text>}
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Account</Text>
          <TouchableOpacity 
            style={[styles.option, isDarkMode && styles.optionDark]} 
            onPress={() => router.push('/profile')}
          >
            <View style={styles.optionIcon}>
              <User size={20} color="#6366F1" />
            </View>
            <Text style={[styles.optionText, isDarkMode && styles.optionTextDark]}>Profile</Text>
            <ChevronRight size={20} color={isDarkMode ? "#9CA3AF" : "#9CA3AF"} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Preferences</Text>
          
          <View style={[styles.option, isDarkMode && styles.optionDark]}>
            <View style={styles.optionIcon}>
              <Moon size={20} color="#6366F1" />
            </View>
            <Text style={[styles.optionText, isDarkMode && styles.optionTextDark]}>Dark Mode</Text>
            <Switch
              trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
              thumbColor={isDarkMode ? '#6366F1' : '#9CA3AF'}
              value={isDarkMode}
              onValueChange={toggleTheme}
            />
          </View>
        </View>

        <TouchableOpacity style={[styles.logoutButton, isDarkMode && styles.logoutButtonDark]} onPress={handleLogout}>
          <LogOut size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#374151',
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: '#1F2937',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  welcomeText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#6366F1',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  sectionTitleDark: {
    color: '#9CA3AF',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  optionDark: {
    backgroundColor: '#374151',
  },
  optionIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionText: {
    flex: 1,
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#1F2937',
  },
  optionTextDark: {
    color: '#F9FAFB',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 'auto',
  },
  logoutButtonDark: {
    backgroundColor: '#7F1D1D',
  },
  logoutText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#EF4444',
  },
});