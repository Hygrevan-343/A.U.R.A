// app/profile.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { ChevronLeft, Mail, Phone, BookOpen, School, Building, User as UserIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { isDarkMode } = useTheme();

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeft color="#FFFFFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <UserIcon size={40} color="#6366F1" />
            </View>
          </View>
          <Text style={[styles.name, isDarkMode && styles.nameDark]}>{user?.name || 'User'}</Text>
          <Text style={[styles.role, isDarkMode && styles.roleDark]}>{user?.role === 'professor' ? 'Faculty' : user?.role || 'User'}</Text>
        </View>

        <View style={[styles.card, isDarkMode && styles.cardDark]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Personal Information</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <UserIcon size={20} color="#6366F1" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>Username</Text>
              <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>{user?.username || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Mail size={20} color="#6366F1" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>Email</Text>
              <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>{user?.email || 'Not provided'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Phone size={20} color="#6366F1" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>Contact</Text>
              <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>{user?.contact || 'Not provided'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, isDarkMode && styles.cardDark]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Academic Information</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <School size={20} color="#6366F1" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>Department</Text>
              <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>{user?.department || 'Artificial Intelligence'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Building size={20} color="#6366F1" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>Institution</Text>
              <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>{'Amrita Vishwa Vidyapeetham'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <BookOpen size={20} color="#6366F1" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>Assigned Courses</Text>
              <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>{user?.assignedCourses?.length || 0} courses assigned</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    backgroundColor: '#6366F1',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerDark: {
    backgroundColor: '#4F46E5',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 20,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6366F1',
  },
  name: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: '#1F2937',
    marginBottom: 4,
  },
  nameDark: {
    color: '#F9FAFB',
  },
  role: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  roleDark: {
    color: '#9CA3AF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.2,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#1F2937',
    marginBottom: 16,
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#6B7280',
  },
  infoLabelDark: {
    color: '#9CA3AF',
  },
  infoValue: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#1F2937',
  },
  infoValueDark: {
    color: '#F9FAFB',
  },
});