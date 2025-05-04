import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Modal, Alert, Linking,RefreshControl } from 'react-native';
import { Book, Clock, Camera, UserCheck, UserX, Upload, User ,Fingerprint, AlertTriangle,FileSpreadsheet, Calendar as CalendarIcon} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { Calendar } from 'react-native-calendars';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import AttendanceVerificationTable from '../../components/AttendanceVerificationTable';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

// Define types for the schedule
interface ScheduleItem {
  day: string;
  start: string;
  end: string;
  subject?: string;
}

interface BatchSchedule {
  [batchName: string]: ScheduleItem[];
}

interface Course {
  id: string;
  courseName: string;
  courseCode: string;
}

// Type for calendar marked dates
interface MarkedDates {
  [date: string]: {
    selected?: boolean;
    marked?: boolean;
    dotColor?: string;
    selectedColor?: string;
  }
}

// Type for attendance results
interface AttendanceResult {
  present: string[];
  absent: string[];
  total_detected: number;
  total_absent: number;
}

interface StudentAttendance {
  rollNo: string;
  name: string;
  isPresent: boolean;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Modify the existing code by adding this to the state declarations

// Add this function to toggle attendance status
const toggleAttendanceStatus = (student: string, currentStatus: boolean) => {
  const [rollNo, name] = student.split('_');
  
  setEditedAttendance(prev => {
    // Check if this student is already in the edited list
    const existingIndex = prev.findIndex(s => s.rollNo === rollNo);
    
    if (existingIndex >= 0) {
      // Update existing entry
      const updated = [...prev];
      updated[existingIndex] = {
        ...updated[existingIndex],
        isPresent: !updated[existingIndex].isPresent
      };
      return updated;
    } else {
      // Add new entry
      return [...prev, { rollNo, name: name || '', isPresent: !currentStatus }];
    }
  });
};

// Check if a student's status has been toggled
const isStatusToggled = (rollNo: string) => {
  const editedStudent = editedAttendance.find(s => s.rollNo === rollNo);
  return editedStudent !== undefined;
};

// Get the current status of a student (considering edits)
const getCurrentStatus = (student: string, defaultIsPresent: boolean) => {
  const rollNo = student.split('_')[0];
  const editedStudent = editedAttendance.find(s => s.rollNo === rollNo);
  return editedStudent ? editedStudent.isPresent : defaultIsPresent;
};


// Helper function to get upcoming week's dates (today and future days)
const getUpcomingWeekDates = () => {
  const today = new Date();
  const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const weekDates = [];
  
  // Include today's date
  weekDates.push(new Date(today));
  
  // Add remaining days of the week
  for (let i = 1; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    // Only include weekdays (Monday to Friday)
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      weekDates.push(date);
    }
    // Stop once we have dates for 5 days
    if (weekDates.length >= 5) break;
  }
  
  return weekDates;
};

// API URLs
const API_URL = 'http://192.168.148.111:5000';
const MODEL_API_URL = 'http://192.168.148.111:5001';

export default function HomeScreen() {
  const { isDarkMode } = useTheme();

  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuth();
  const [schedule, setSchedule] = useState<BatchSchedule>({ 'A': [], 'B': [] }); // Initialize with both batches
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('A'); // Default to Batch A
  const [selectedDate, setSelectedDate] = useState('');
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const upcomingDates = getUpcomingWeekDates(); 

  const [selectedCourse, setSelectedCourse] = useState<string | undefined>(undefined);

  
  // Attendance States
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [processingAttendance, setProcessingAttendance] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<AttendanceResult | null>(null);
  const [attendanceSessionId, setAttendanceSessionId] = useState<string | null>(null);

  const [editedAttendance, setEditedAttendance] = useState<StudentAttendance[]>([]);

  const [attendanceVerificationData, setAttendanceVerificationData] = useState<Record<string, any>>({});

  const [showDetailedVerification, setShowDetailedVerification] = useState(false);

  const [attendanceExistsForDate, setAttendanceExistsForDate] = useState(false);

const checkAttendanceExistsForDate = (date: string) => {
  return markedDates[date]?.marked === true;
};

const onRefresh = async () => {
  // Only proceed if a user is logged in
  if (!user?.username) return;

  setRefreshing(true);

  try {
    // Refresh all data
    await Promise.all([
      fetchSchedule(user.username),
      fetchCourses(user.username),
      fetchMarkedAttendanceDates(selectedBatch, selectedCourse || (courses.length > 0 ? courses[0].id : undefined))
    ]);
  } catch (error) {
    console.error('Error refreshing data:', error);
    setError('Failed to refresh data. Pull down to try again.');
  } finally {
    setRefreshing(false);
  }
};

  const StudentVerificationStatus = ({ student }: { student: string }) => {
    const rollNo = student.split('_')[0];
    const verificationData = attendanceVerificationData[rollNo];
    
    if (!verificationData) return null;
    
    return (
      <View style={styles.verificationStatus}>
        {/* Face Recognition Status */}
        {verificationData.faceRecognition?.status ? (
          <User size={16} color="#22c55e" />
        ) : (
          <User size={16} color="#94a3b8" />
        )}
        
        {/* RFID Status */}
        {verificationData.rfidCheckIn?.status ? (
          <Fingerprint size={16} color="#22c55e" />
        ) : (
          <Fingerprint size={16} color="#94a3b8" />
        )}
        
        {/* Proxy Warning */}
        {verificationData.possibleProxy && (
          <AlertTriangle size={16} color="#f59e0b" />
        )}
      </View>
    );
  };

  const downloadAttendanceReport = async () => {
    try {
      // Construct the URL with query parameters
      const courseId = selectedCourse || (courses.length > 0 ? courses[0].id : undefined);
      let url = `${API_URL}/attendance/export?date=${selectedDate}&batch=${selectedBatch}`;
      if (courseId) {
        url += `&courseId=${courseId}`;
      }
      
      // Open the URL in a new window/tab to trigger download
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        // For mobile, use Linking to open in browser
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Cannot open URL to download report');
        }
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      Alert.alert('Error', 'Failed to download attendance report');
    }
  };



  const isStatusToggled = (rollNo: string) => {
    const editedStudent = editedAttendance.find(s => s.rollNo === rollNo);
    return editedStudent !== undefined;
  };

  // Get the current status of a student (considering edits)
  const getCurrentStatus = (student: string, defaultIsPresent: boolean) => {
    const rollNo = student.split('_')[0];
    const editedStudent = editedAttendance.find(s => s.rollNo === rollNo);
    return editedStudent ? editedStudent.isPresent : defaultIsPresent;
  };
  
  // Also don't forget to move the toggleAttendanceStatus function inside the component
  const toggleAttendanceStatus = (student: string, currentStatus: boolean) => {
    const [rollNo, name] = student.split('_');
    
    setEditedAttendance(prev => {
      // Check if this student is already in the edited list
      const existingIndex = prev.findIndex(s => s.rollNo === rollNo);
      
      if (existingIndex >= 0) {
        // Update existing entry
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          isPresent: !updated[existingIndex].isPresent
        };
        return updated;
      } else {
        // Add new entry
        return [...prev, { rollNo, name: name || '', isPresent: !currentStatus }];
      }
    });
  };


  useEffect(() => {
    if (user?.username) {
      fetchSchedule(user.username);
      fetchCourses(user.username);
  
      // Set today as the initially selected date
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      setSelectedDate(formattedDate);
      
      // Fetch marked dates for the initial batch
      fetchMarkedAttendanceDates(selectedBatch);
    } else {
      setLoading(false);
    }
  }, [user]);

  // Add effect to update displayed schedule when batch changes
  useEffect(() => {
    console.log("Selected batch changed to:", selectedBatch);
    if (user?.username) {
      // If a course is selected, pass its ID
      const courseId = selectedCourse || (courses.length > 0 ? courses[0].id : undefined);
      fetchMarkedAttendanceDates(selectedBatch, courseId);
    }
  }, [selectedBatch, selectedCourse, user?.username, courses]);

  // Update the useEffect that handles batch and course changes
useEffect(() => {
  if (user?.username) {
    // If a course is selected, pass its ID
    const courseId = selectedCourse || (courses.length > 0 ? courses[0].id : undefined);
    console.log("Fetching marked dates for batch:", selectedBatch, "course:", courseId);
    fetchMarkedAttendanceDates(selectedBatch, courseId);
  }
}, [selectedBatch, selectedCourse, user?.username]);


  const handleDateSelect = (day: any) => {
  const selectedDate = day.dateString;
  
  // Update the selected date
  setSelectedDate(selectedDate);
  setAttendanceExistsForDate(checkAttendanceExistsForDate(selectedDate));

  // Update marked dates to highlight the selected date while preserving markers
  setMarkedDates(prev => {
    const updatedMarkedDates = { ...prev };
    
    // Remove the selected styling from all dates
    Object.keys(updatedMarkedDates).forEach(date => {
      if (updatedMarkedDates[date].selected) {
        const { selected, selectedColor, ...rest } = updatedMarkedDates[date];
        updatedMarkedDates[date] = rest;
      }
    });
    
    // Add selected styling to the current date
    updatedMarkedDates[selectedDate] = {
      ...updatedMarkedDates[selectedDate],
      selected: true,
      selectedColor: '#6366F1',
    };
    
    return updatedMarkedDates;
  });
};


  const fetchSchedule = async (username: string) => {
    try {
      console.log("Fetching schedule for:", username);
      const response = await fetch(`${API_URL}/schedule/${username}`);
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Raw schedule data received:", JSON.stringify(data));
      
      if (data && data.schedule) {
        // Create a new schedule object with empty arrays as defaults
        const normalizedSchedule: BatchSchedule = {
          'A': [],
          'B': []
        };
        
        // Copy any existing schedule data
        if (data.schedule.A && Array.isArray(data.schedule.A)) {
          normalizedSchedule.A = data.schedule.A;
        }
        
        if (data.schedule.B && Array.isArray(data.schedule.B)) {
          normalizedSchedule.B = data.schedule.B;
        }
        
        console.log("Normalized schedule:", JSON.stringify(normalizedSchedule));
        setSchedule(normalizedSchedule);
      } else {
        console.warn("No schedule data in response");
      }
    } catch (err) {
      console.error('Error fetching schedule:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async (username: string) => {
    try {
      const response = await fetch(`${API_URL}/assignedCourses/${username}`);
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.courses) {
        setCourses(data.courses);
      } else {
        console.warn("No courses data in response");
        setCourses([]);
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  };

  // Get schedule for selected batch
  const getBatchSchedule = (): ScheduleItem[] => {
    return schedule[selectedBatch] || [];
  };

  // Add this function to fetch marked dates for the selected batch
// Add this function to fetch marked dates for the selected batch and course
// In app/(tabs)/index.tsx, modify the fetchMarkedAttendanceDates function:

const fetchMarkedAttendanceDates = async (batch: string, courseId?: string) => {
  try {
    if (!user?.username) {
      console.warn("Cannot fetch marked dates: No user logged in");
      return;
    }

    // Build URL with parameters including the faculty ID
    let url = `${API_URL}/attendance/marked-dates?batch=${batch}&facultyId=${user.username}`;
    if (courseId) {
      url += `&courseId=${courseId}`;
    }
    
    console.log("Fetching marked dates:", url);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.markedDates) {
      // Create a new marked dates object
      const newMarkedDates = {...markedDates};
      
      // Add markers for dates with attendance records
      data.markedDates.forEach((date: string) => {
        newMarkedDates[date] = {
          ...(newMarkedDates[date] || {}),
          marked: true,
          dotColor: '#10B981' // Green dot for dates with attendance
        };
      });
      
      // Make sure current selected date is highlighted
      if (selectedDate) {
        newMarkedDates[selectedDate] = {
          ...(newMarkedDates[selectedDate] || {}),
          selected: true,
          selectedColor: '#6366F1',
        };
      }
      
      // Update the state with our new object
      setMarkedDates(newMarkedDates);
      
      // Check if attendance exists for the currently selected date
      setAttendanceExistsForDate(data.markedDates.includes(selectedDate));
    }
  } catch (err) {
    console.error('Error fetching marked attendance dates:', err);
  }
};
  // Assigns subjects to schedule items for display purposes
  const getScheduleWithSubjects = (): ScheduleItem[] => {
    const batchSchedule = getBatchSchedule();
    if (batchSchedule.length === 0) return [];
    
    return batchSchedule.map((item, index) => ({
      ...item,
      subject: courses.length > 0 
        ? courses[index % courses.length].courseName 
        : `Subject ${index + 1}`
    }));
  };

  // Filter schedule for selected date
  const getSelectedDateSchedule = (): ScheduleItem[] => {
    if (!selectedDate) return [];
    
    const selectedDay = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
    const scheduleWithSubjects = getScheduleWithSubjects();
    
    return scheduleWithSubjects.filter(item => 
      item.day === selectedDay
    );
  };

  const getFileType = (uri: string): string => {
    const extension = uri.split('.').pop()?.toLowerCase() || '';
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'heic':
        return 'image/heic';
      default:
        return 'image/jpeg'; // Default fallback
    }
  };

  
  // Get upcoming schedule arranged by day with correct dates
  const getUpcomingSchedule = () => {
    const scheduleByDay: { [day: string]: { items: ScheduleItem[], date: Date } } = {};
    
    // Get the current date
    const today = new Date();
    
    // Process each day
    const scheduleItems = getScheduleWithSubjects();
    
    // Process each day of the week
    for (const day of DAYS) {
      // Find items for this day
      const dayItems = scheduleItems.filter(item => item.day === day);
      
      if (dayItems.length > 0) {
        // Get specific day of week number
        let targetDay;
        switch (day) {
          case 'Monday': targetDay = 1; break;
          case 'Tuesday': targetDay = 2; break;
          case 'Wednesday': targetDay = 3; break;
          case 'Thursday': targetDay = 4; break;
          case 'Friday': targetDay = 5; break;
          default: targetDay = 1; break;
        }
        
        // Get current day of week (0 = Sunday, 1 = Monday, etc.)
        const currentDay = today.getDay();
        
        // Calculate days to add to get to next occurrence of target day
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) {
          daysToAdd += 7; // Go to next week
        }
        
        // Create a new date for next occurrence
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysToAdd);
        
        // Store in our map
        scheduleByDay[day] = {
          items: dayItems,
          date: nextDate
        };
      }
    }
    
    return scheduleByDay;
  };

  const renderBatchSelector = () => {
    // Fixed options for A and B batches
    const batches = ['A', 'B'];
    
    return (
      <View style={styles.batchSelector}>
        <Text style={styles.batchSelectorLabel}>Select Batch:</Text>
        <View style={styles.batchButtons}>
          {batches.map(batch => (
            <TouchableOpacity
              key={batch}
              style={[
                styles.batchButton,
                selectedBatch === batch && styles.selectedBatchButton,
                batch === 'B' && styles.disabledBatchButton // Apply disabled style to B
              ]}
              onPress={() => batch === 'A' && setSelectedBatch(batch)} // Only allow A to be selected
              disabled={batch === 'B'} // Disable B button
            >
              <Text style={[
                styles.batchButtonText,
                selectedBatch === batch && styles.selectedBatchButtonText,
                batch === 'B' && styles.disabledBatchButtonText // Apply disabled text style to B
              ]}>
                {batch}
                {batch === 'B' && " (Coming Soon)"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderCourseSelector = () => {
    if (courses.length === 0) return null;
    
    return (
      <View style={styles.courseSelector}>
  <Text style={styles.courseSelectorLabel}>Select Course:</Text>
  <View style={styles.courseButtons}>
    {/* Only show available courses for the faculty */}
    {courses.map(course => (
      <TouchableOpacity
        key={course.id}
        style={[
          styles.courseButton,
          (!selectedCourse && courses[0]?.id === course.id) || selectedCourse === course.id 
            ? styles.selectedCourseButton 
            : null
        ]}
        onPress={() => {
          setSelectedCourse(course.id);
          fetchMarkedAttendanceDates(selectedBatch, course.id);
        }}
      >
        <Text style={[
          styles.courseButtonText,
          (!selectedCourse && courses[0]?.id === course.id) || selectedCourse === course.id 
            ? styles.selectedCourseButtonText 
            : null
        ]}>
          {course.courseCode || course.courseName}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
</View>
    );
  };

  // Create attendance session
  const createAttendanceSession = async () => {
    try {
      const response = await fetch(`${API_URL}/attendance/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          batchId: selectedBatch,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      setAttendanceSessionId(data.sessionId);
      return data.sessionId;
    } catch (err) {
      console.error('Error creating attendance session:', err);
      setError('Failed to create attendance session. Please try again.');
      return null;
    }
  };

  // Open image picker for attendance
  const handleOpenAttendanceModal = async () => {
    // Only open if there are classes scheduled for this day
    const scheduleForDay = getSelectedDateSchedule();
    if (scheduleForDay.length === 0) {
      Alert.alert('No Classes', 'There are no classes scheduled for this day.');
      return;
    }

    // Create an attendance session first
    const sessionId = await createAttendanceSession();
    if (!sessionId) {
      Alert.alert('Error', 'Failed to create attendance session. Please try again.');
      return;
    }

    setAttendanceModalVisible(true);
    setSelectedImages([]);
    setAttendanceResult(null);
  };

  // Pick images from gallery
  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
        setSelectedImages([...selectedImages, ...result.assets]);
      }
    } catch (err) {
      console.error('Error picking images:', err);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  // Take photo using camera
  const takePhoto = async () => {
    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (cameraPermission.status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
        setSelectedImages([...selectedImages, ...result.assets]);
      }
    } catch (err) {
      console.error('Error taking photo:', err);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Remove an image from selected images
  const removeImage = (index: number) => {
    const newImages = [...selectedImages];
    newImages.splice(index, 1);
    setSelectedImages(newImages);
  };

  // Process attendance using the model API
  // Process attendance using the model API
// Process attendance using the model API
const processAttendance = async () => {
  if (selectedImages.length === 0) {
    Alert.alert('No Images', 'Please select at least one image to process attendance.');
    return;
  }

  setProcessingAttendance(true);
  setAttendanceVerificationData({});  // Clear previous verification data

  try {
    const formData = new FormData();
    const courseId = selectedCourse || (courses.length > 0 ? courses[0].id : undefined);

    
    // Prepare images for upload
    for (const image of selectedImages) {
      const uri = image.uri;
      const name = uri.split('/').pop();
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      if (!fileInfo.exists) {
        console.error('File does not exist:', uri);
        continue;
      }
      
      // Create blob object for FormData
      formData.append('images', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: name,
        type: getFileType(uri) || 'image/jpeg',
      } as any);
    }

    console.log('Making request to:', `${MODEL_API_URL}/recognize`);

    // Upload images to facial recognition API
    const response = await fetch(`${MODEL_API_URL}/recognize`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server responded with status: ${response.status}, ${errorText}`);
    }

    const modelResult = await response.json();
    console.log('Face recognition result:', modelResult);
    
    // Now verify the attendance with RFID records
    try {
      console.log('Verifying attendance with RFID records...');
      console.log('Request data:', {
        date: selectedDate,
        batch: selectedBatch,
        recognizedStudents: modelResult.present || []
      });
      
      const verifyResponse = await fetch(`${API_URL}/attendance/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          batch: selectedBatch,
          courseId: courseId,  // Add courseId parameter
          recognizedStudents: modelResult.present || []
        }),
      });
      
      if (!verifyResponse.ok) {
        const errText = await verifyResponse.text();
        console.error('Verification API error:', errText);
        throw new Error(`Failed to verify attendance: ${verifyResponse.status}`);
      }
      
      const verificationResult = await verifyResponse.json();
      console.log('Verification result:', verificationResult);
      
      // Store verification data for UI display
      setAttendanceVerificationData(verificationResult.students || {});
      
      // Use the output lists from the API directly
      if (verificationResult.output) {
        setAttendanceResult({
          present: verificationResult.output.present || [],
          absent: verificationResult.output.absent || []
        });
      } else {
        // Convert verification results to present and absent lists if output not provided
        const present = [];
        const absent = [];
        
        Object.entries(verificationResult.students || {}).forEach(([rollNo, studentData]: [string, any]) => {
          const studentString = `${studentData.rollNo}_${studentData.name}`;
          
          if (studentData.isPresent) {
            present.push(studentString);
          } else {
            absent.push(studentString);
          }
        });
        
        setAttendanceResult({
          present,
          absent
        });
      }
      
    } catch (verifyErr) {
      console.error('Error during verification:', verifyErr);
      // Fall back to model results if verification fails
      setAttendanceResult(modelResult);
    }
    
  } catch (err) {
    console.error('Error processing attendance:', err);
    Alert.alert('Error', 'Failed to process attendance. Please try again.');
  } finally {
    setProcessingAttendance(false);
  }
};
  // Update attendance results in the main API
  // Update attendance results in the main API
  const updateAttendanceResults = async (sessionId: string, results: AttendanceResult) => {
    try {
      console.log('Updating attendance results for session:', sessionId);
      const courseId = selectedCourse || (courses.length > 0 ? courses[0].id : "");
      const courseInfo = {
      courseId: courseId,
      courseName: courses.find(c => c.id === courseId)?.courseName || "Unknown Course"
    };
      
      // Get selected date and course information for this session
      const scheduleForDay = getSelectedDateSchedule();
     
      
      // Process present and absent lists considering edits
      const presentStudents: { rollNo: string, name: string, verificationData?: any }[] = [];
      const absentStudents: { rollNo: string, name: string, verificationData?: any }[] = [];
      
      // Process original present students
      results.present.forEach(student => {
        const [rollNo, name] = student.split('_');
        const isPresent = getCurrentStatus(student, true);
        const verificationData = attendanceVerificationData[rollNo];
        
        if (isPresent) {
          presentStudents.push({ 
            rollNo, 
            name: name || '',
            verificationData
          });
        } else {
          absentStudents.push({ 
            rollNo, 
            name: name || '',
            verificationData
          });
        }
      });
      
      // Process original absent students
      results.absent.forEach(student => {
        const [rollNo, name] = student.split('_');
        const isPresent = getCurrentStatus(student, false);
        const verificationData = attendanceVerificationData[rollNo];
        
        if (isPresent) {
          presentStudents.push({ 
            rollNo, 
            name: name || '',
            verificationData
          });
        } else {
          absentStudents.push({ 
            rollNo, 
            name: name || '',
            verificationData
          });
        }
      });
      
      // Calculate updated totals
      const totalPresent = presentStudents.length;
      const totalAbsent = absentStudents.length;
  
      // Send attendance data to backend
      const response = await fetch(`${API_URL}/attendance/sessions/${sessionId}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          courseId: courseInfo.courseId,
          courseName: courseInfo.courseName,
          batchId: selectedBatch,
          facultyId: user?.username || "",
          facultyName: user?.name || "",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          presentStudents,
          absentStudents,
          totalPresent,
          totalAbsent,
          verificationData: attendanceVerificationData
        }),
      });
  
      if (!response.ok) {
        throw new Error(`Failed to update attendance results: ${response.status}`);
      }
      
      Alert.alert('Success', 'Attendance saved to database successfully');
      const currentCourseId = selectedCourse || (courses.length > 0 ? courses[0].id : undefined);
     fetchMarkedAttendanceDates(selectedBatch, currentCourseId);
    } catch (err) {
      console.error('Error updating attendance results:', err);
      Alert.alert('Error', 'Failed to save attendance results to database. Please try again.');
    }
  };


const resetAttendanceState = () => {
  setAttendanceResult(null);
  setSelectedImages([]);
  setEditedAttendance([]);
};



return (
  <View style={[styles.container, isDarkMode && styles.containerDark]}>
    <View style={[styles.header, isDarkMode && styles.headerDark]}>
      <Text style={styles.greeting}>Hello, {user?.name || 'Professor'}</Text>
      <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
    </View>

    <ScrollView 
      style={[styles.content, isDarkMode && styles.contentDark]} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#6366F1']}
          tintColor={isDarkMode ? '#818CF8' : '#6366F1'}
        />
      }
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          {/* Batch Selector */}
          <View style={[styles.batchSelector, isDarkMode && styles.sectionDark]}>
            <Text style={[styles.batchSelectorLabel, isDarkMode && styles.labelTextDark]}>Select Batch:</Text>
            <View style={styles.batchButtons}>
              {['A', 'B'].map(batch => (
                <TouchableOpacity
                  key={batch}
                  style={[
                    styles.batchButton,
                    isDarkMode && styles.batchButtonDark,
                    selectedBatch === batch && styles.selectedBatchButton,
                    selectedBatch === batch && isDarkMode && styles.selectedBatchButtonDark,
                    batch === 'B' && styles.disabledBatchButton,
                    batch === 'B' && isDarkMode && styles.disabledBatchButtonDark
                  ]}
                  onPress={() => batch === 'A' && setSelectedBatch(batch)}
                  disabled={batch === 'B'}
                >
                  <Text style={[
                    styles.batchButtonText,
                    isDarkMode && styles.batchButtonTextDark,
                    selectedBatch === batch && styles.selectedBatchButtonText,
                    batch === 'B' && styles.disabledBatchButtonText,
                    batch === 'B' && isDarkMode && styles.disabledBatchButtonTextDark
                  ]}>
                    {batch}
                    {batch === 'B' && " (Coming Soon)"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Course Selector */}
          {courses.length > 0 && (
            <View style={[styles.courseSelector, isDarkMode && styles.sectionDark]}>
              <Text style={[styles.courseSelectorLabel, isDarkMode && styles.labelTextDark]}>Select Course:</Text>
              <View style={styles.courseButtons}>
                {courses.map(course => (
                  <TouchableOpacity
                    key={course.id}
                    style={[
                      styles.courseButton,
                      isDarkMode && styles.courseButtonDark,
                      ((!selectedCourse && courses[0]?.id === course.id) || selectedCourse === course.id) && styles.selectedCourseButton,
                      ((!selectedCourse && courses[0]?.id === course.id) || selectedCourse === course.id) && isDarkMode && styles.selectedCourseButtonDark
                    ]}
                    onPress={() => {
                      setSelectedCourse(course.id);
                      fetchMarkedAttendanceDates(selectedBatch, course.id);
                    }}
                  >
                    <Text style={[
                      styles.courseButtonText,
                      isDarkMode && styles.courseButtonTextDark,
                      ((!selectedCourse && courses[0]?.id === course.id) || selectedCourse === course.id) && styles.selectedCourseButtonText
                    ]}>
                      {course.courseCode || course.courseName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          
          {/* Schedule Calendar Section */}
          <View style={[styles.section, isDarkMode && styles.sectionDark]}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Schedule Calendar</Text>
            <View style={[styles.calendarContainer, isDarkMode && styles.calendarContainerDark]}>
              <Calendar
                onDayPress={handleDateSelect}
                markedDates={markedDates}
                theme={{
                  backgroundColor: isDarkMode ? '#1F2937' : '#ffffff',
                  calendarBackground: isDarkMode ? '#1F2937' : '#ffffff',
                  textSectionTitleColor: isDarkMode ? '#818CF8' : '#6366F1',
                  selectedDayBackgroundColor: '#6366F1',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: isDarkMode ? '#818CF8' : '#6366F1',
                  dayTextColor: isDarkMode ? '#F9FAFB' : '#1F2937',
                  textDisabledColor: isDarkMode ? '#4B5563' : '#d9e1e8',
                  dotColor: isDarkMode ? '#818CF8' : '#6366F1',
                  selectedDotColor: '#ffffff',
                  arrowColor: isDarkMode ? '#818CF8' : '#6366F1',
                  monthTextColor: isDarkMode ? '#F9FAFB' : '#1F2937',
                  indicatorColor: isDarkMode ? '#818CF8' : '#6366F1',
                  textDayHeaderColor: isDarkMode ? '#9CA3AF' : '#4B5563',
                }}
              />
              
              {/* Selected Date Schedule */}
              {selectedDate && (
                <View style={[styles.selectedDateSchedule, isDarkMode && styles.selectedDateScheduleDark]}>
                  <View style={styles.selectedDateHeader}>
                    <Text style={[styles.selectedDateText, isDarkMode && styles.selectedDateTextDark]}>
                      Schedule for {new Date(selectedDate).toDateString()}
                      {` - Batch ${selectedBatch}`}
                    </Text>
                    
                    {attendanceExistsForDate && (
                      <TouchableOpacity 
                        style={styles.downloadReportButton}
                        onPress={downloadAttendanceReport}
                      >
                        <FileSpreadsheet size={16} color="#FFFFFF" />
                        <Text style={styles.downloadReportButtonText}>Export Excel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {/* Schedule Cards */}
                  {getSelectedDateSchedule().length > 0 ? (
                    getSelectedDateSchedule().map((item, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={[styles.scheduleCard, isDarkMode && styles.scheduleCardDark]}
                        onPress={handleOpenAttendanceModal}
                      >
                        <Clock size={20} color="#6366F1" />
                        <View style={styles.scheduleInfo}>
                          <Text style={[styles.scheduleTime, isDarkMode && styles.scheduleTimeDark]}>{`${item.start} - ${item.end}`}</Text>
                          <Text style={[styles.batchLabel, isDarkMode && styles.batchLabelDark]}>Batch {selectedBatch}</Text>
                        </View>
                        <Text style={styles.scheduleSubject}>{item.subject}</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={[styles.noScheduleText, isDarkMode && styles.noScheduleTextDark]}>No classes scheduled for this day</Text>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Weekly Schedule Section */}
          <View style={[styles.section, isDarkMode && styles.sectionDark]}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Classes for this week</Text>
            {Object.keys(getUpcomingSchedule()).length > 0 ? (
              Object.entries(getUpcomingSchedule())
                .sort(([, a], [, b]) => a.date.getTime() - b.date.getTime())
                .map(([day, { items, date }]) => {
                  const month = date.toLocaleString('en-US', { month: 'short' });
                  const dayNum = date.getDate();
                  
                  return (
                    <View key={day} style={styles.daySchedule}>
                      <Text style={[styles.dayTitle, isDarkMode && styles.dayTitleDark]}>
                        {`${day} (${month} ${dayNum})`}
                      </Text>
                      {items.map((item, itemIndex) => (
                        <TouchableOpacity 
                          key={itemIndex} 
                          style={[styles.scheduleCard, isDarkMode && styles.scheduleCardDark]}
                        >
                          <Clock size={20} color="#6366F1" />
                          <View style={styles.scheduleInfo}>
                            <Text style={[styles.scheduleTime, isDarkMode && styles.scheduleTimeDark]}>{`${item.start} - ${item.end}`}</Text>
                            <Text style={[styles.batchLabel, isDarkMode && styles.batchLabelDark]}>Batch {selectedBatch}</Text>
                          </View>
                          <Text style={styles.scheduleSubject}>{item.subject}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })
            ) : (
              <Text style={[styles.noScheduleText, isDarkMode && styles.noScheduleTextDark]}>No upcoming classes for Batch {selectedBatch}</Text>
            )}
          </View>

          {/* Assigned Courses Section */}
          <View style={[styles.section, isDarkMode && styles.sectionDark]}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Assigned Courses</Text>
            <View style={styles.subjectsGrid}>
              {courses.length > 0 ? (
                courses.map((course, index) => (
                  <TouchableOpacity key={index} style={[styles.subjectCard, isDarkMode && styles.subjectCardDark]}>
                    <Book size={24} color="#6366F1" />
                    <Text style={[styles.subjectName, isDarkMode && styles.subjectNameDark]}>{course.courseName}</Text>
                    <Text style={[styles.courseCode, isDarkMode && styles.courseCodeDark]}>{course.courseCode}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.noScheduleText, isDarkMode && styles.noScheduleTextDark]}>No courses assigned yet</Text>
              )}
            </View>
          </View>
        </>
      )}
    </ScrollView>

    {/* Attendance Modal */}
    <Modal
      animationType="slide"
      transparent={false}
      visible={attendanceModalVisible}
      onRequestClose={() => {
        setAttendanceModalVisible(false);
      }}
    >
      <View style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
        <View style={[styles.modalHeader, isDarkMode && styles.modalHeaderDark]}>
          <Text style={styles.modalTitle}>Class Attendance</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setAttendanceModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={[styles.modalContent, isDarkMode && styles.modalContentDark]}>
          
          <Text style={[styles.modalSubtitle, isDarkMode && styles.modalSubtitleDark]}>
            {selectedDate && new Date(selectedDate).toDateString()} - Batch {selectedBatch}
          </Text>

          {!attendanceResult ? (
            <>
              {/* Image picker buttons */}
              <View style={styles.imagePickerButtons}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.cameraButton]} 
                  onPress={takePhoto}
                >
                  <Camera size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>Take Photo</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.galleryButton]} 
                  onPress={pickImages}
                >
                  <Upload size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>Upload Images</Text>
                </TouchableOpacity>
              </View>

              {/* Selected images section */}
              {selectedImages.length > 0 && (
                <View style={styles.selectedImagesContainer}>
                  <Text style={[styles.selectedImagesTitle, isDarkMode && styles.selectedImagesTitleDark]}>Selected Images ({selectedImages.length})</Text>
                  <View style={styles.imageGrid}>
                    {selectedImages.map((image, index) => (
                      <View key={index} style={styles.imageContainer}>
                        <Image source={{ uri: image.uri }} style={styles.thumbnail} />
                        <TouchableOpacity 
                          style={styles.removeButton}
                          onPress={() => removeImage(index)}
                        >
                          <Text style={styles.removeButtonText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                  
                  <TouchableOpacity 
                    style={[
                      styles.processButton, 
                      processingAttendance && styles.disabledButton
                    ]}
                    onPress={processAttendance}
                    disabled={processingAttendance}
                  >
                    {processingAttendance ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.processButtonText}>Process Attendance</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.attendanceResultsContainer, isDarkMode && styles.attendanceResultsContainerDark]}>
              <Text style={[styles.attendanceResultsTitle, isDarkMode && styles.attendanceResultsTitleDark]}>Attendance Results</Text>
              
              <View style={styles.attendanceStatsContainer}>
                <View style={[styles.attendanceStat, styles.presentStat, isDarkMode && styles.presentStatDark]}>
                  <UserCheck size={24} color="#10B981" />
                  <Text style={[styles.attendanceStatValue, isDarkMode && styles.attendanceStatValueDark]}>
                    {attendanceResult.present.filter(s => getCurrentStatus(s, true)).length}
                  </Text>
                  <Text style={[styles.attendanceStatLabel, isDarkMode && styles.attendanceStatLabelDark]}>Present</Text>
                </View>
                
                <View style={[styles.attendanceStat, styles.absentStat, isDarkMode && styles.absentStatDark]}>
                  <UserX size={24} color="#EF4444" />
                  <Text style={[styles.attendanceStatValue, isDarkMode && styles.attendanceStatValueDark]}>
                    {attendanceResult.absent.filter(s => !getCurrentStatus(s, false)).length + 
                    attendanceResult.present.filter(s => !getCurrentStatus(s, true)).length}
                  </Text>
                  <Text style={[styles.attendanceStatLabel, isDarkMode && styles.attendanceStatLabelDark]}>Absent</Text>
                </View>
              </View>
              
              <View style={styles.attendanceListContainer}>
                {/* Present students list */}
                <View style={styles.attendanceListSection}>
                  <Text style={[styles.attendanceListTitle, isDarkMode && styles.attendanceListTitleDark]}>Present Students</Text>
                  {attendanceResult.present.length > 0 ? (
                    attendanceResult.present.map((student, index) => {
                      const isPresent = getCurrentStatus(student, true);
                      const rollNo = student.split('_')[0];
                      const verificationData = attendanceVerificationData[rollNo];
                      const isPossibleProxy = verificationData?.possibleProxy;
                      
                      return (
                        <TouchableOpacity 
                          key={index} 
                          style={[
                            styles.studentItem,
                            isDarkMode && styles.studentItemDark, 
                            isStatusToggled(rollNo) && styles.editedStudentItem,
                            isStatusToggled(rollNo) && isDarkMode && styles.editedStudentItemDark,
                            !isPresent && styles.markedAbsentItem,
                            !isPresent && isDarkMode && styles.markedAbsentItemDark,
                            isPossibleProxy && styles.proxyWarningItem,
                            isPossibleProxy && isDarkMode && styles.proxyWarningItemDark
                          ]}
                          onPress={() => toggleAttendanceStatus(student, true)}
                        >
                          {isPresent ? (
                            <UserCheck size={16} color="#10B981" />
                          ) : (
                            <UserX size={16} color="#EF4444" />
                          )}
                          <Text style={[styles.studentName, isDarkMode && styles.studentNameDark]}>{student}</Text>
                          <StudentVerificationStatus student={student} />
                          <View style={styles.editIndicator}>
                            <Text style={[styles.editText, isDarkMode && styles.editTextDark]}>
                              {isStatusToggled(rollNo) ? (isPresent ? "Corrected: Present" : "Corrected: Absent") : ""}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={[styles.noStudentsText, isDarkMode && styles.noStudentsTextDark]}>No students present</Text>
                  )}
                </View>
                
                {/* Absent students list */}
                <View style={styles.attendanceListSection}>
                  <Text style={[styles.attendanceListTitle, isDarkMode && styles.attendanceListTitleDark]}>Absent Students</Text>
                  {attendanceResult.absent.length > 0 ? (
                    attendanceResult.absent.map((student, index) => {
                      const isPresent = getCurrentStatus(student, false);
                      const rollNo = student.split('_')[0];
                      const verificationData = attendanceVerificationData[rollNo];
                      const isPossibleProxy = verificationData?.possibleProxy;
                      
                      return (
                        <TouchableOpacity 
                          key={index} 
                          style={[
                            styles.studentItem,
                            isDarkMode && styles.studentItemDark, 
                            isStatusToggled(rollNo) && styles.editedStudentItem,
                            isStatusToggled(rollNo) && isDarkMode && styles.editedStudentItemDark,
                            isPresent && styles.markedPresentItem,
                            isPresent && isDarkMode && styles.markedPresentItemDark,
                            isPossibleProxy && styles.proxyWarningItem,
                            isPossibleProxy && isDarkMode && styles.proxyWarningItemDark
                          ]}
                          onPress={() => toggleAttendanceStatus(student, false)}
                        >
                          {isPresent ? (
                            <UserCheck size={16} color="#10B981" />
                          ) : (
                            <UserX size={16} color="#EF4444" />
                          )}
                          <Text style={[styles.studentName, isDarkMode && styles.studentNameDark]}>{student}</Text>
                          <StudentVerificationStatus student={student} />
                          <View style={styles.editIndicator}>
                            <Text style={[styles.editText, isDarkMode && styles.editTextDark]}>
                              {isStatusToggled(rollNo) ? (isPresent ? "Corrected: Present" : "Corrected: Absent") : ""}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={[styles.noStudentsText, isDarkMode && styles.noStudentsTextDark]}>No students absent</Text>
                  )}
                </View>
              </View>
              
              {/* Verification legends */}
              {Object.keys(attendanceVerificationData || {}).length > 0 && (
                <View style={[styles.verificationLegend, isDarkMode && styles.verificationLegendDark]}>
                  <Text style={[styles.legendTitle, isDarkMode && styles.legendTitleDark]}>Attendance Verification:</Text>
                  <View style={styles.legendItems}>
                    <View style={styles.legendItem}>
                      <User size={14} color="#22c55e" />
                      <Text style={[styles.legendText, isDarkMode && styles.legendTextDark]}>Face Detection</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <Fingerprint size={14} color="#22c55e" />
                      <Text style={[styles.legendText, isDarkMode && styles.legendTextDark]}>RFID Scan</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <AlertTriangle size={14} color="#f59e0b" />
                      <Text style={[styles.legendText, isDarkMode && styles.legendTextDark]}>Possible Proxy</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Detailed verification table */}
              {Object.keys(attendanceVerificationData || {}).length > 0 && (
                <View style={styles.detailedVerificationTableContainer}>
                  <TouchableOpacity
                    style={[styles.expandButton, isDarkMode && styles.expandButtonDark]}
                    onPress={() => setShowDetailedVerification(!showDetailedVerification)}
                  >
                    <Text style={[styles.expandButtonText, isDarkMode && styles.expandButtonTextDark]}>
                      {showDetailedVerification ? "Hide Detailed Verification" : "Show Detailed Verification"}
                    </Text>
                    <ChevronDown 
                      size={18} 
                      color={isDarkMode ? "#818CF8" : "#6366F1"} 
                      style={{ transform: [{ rotate: showDetailedVerification ? '180deg' : '0deg' }] }} 
                    />
                  </TouchableOpacity>
                  
                  {showDetailedVerification && (
                    <AttendanceVerificationTable 
                      students={attendanceVerificationData} 
                      date={selectedDate} 
                      batch={selectedBatch} 
                    />
                  )}
                </View>
              )}
              
              {/* Action buttons */}
              <View style={styles.attendanceActionButtons}>
                <TouchableOpacity 
                  style={styles.newAttendanceButton}
                  onPress={() => {
                    resetAttendanceState();
                  }}
                >
                  <Text style={styles.newAttendanceButtonText}>Take New Attendance</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.uploadDatabaseButton}
                  onPress={() => {
                    if (attendanceSessionId) {
                      updateAttendanceResults(attendanceSessionId, attendanceResult);
                    } else {
                      Alert.alert('Error', 'No active session found. Please try again.');
                    }
                  }}
                >
                  <Upload size={18} color="#FFFFFF" />
                  <Text style={styles.uploadDatabaseButtonText}>Upload to Database</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#6366F1',
  },
  greeting: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: '#fff',
  },
  date: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  batchSelector: {
    marginBottom: 20,
  },
  // Add these to your StyleSheet object
uploadDatabaseButton: {
  backgroundColor: '#3B82F6',
  flexDirection: 'row',
  gap: 8,
  paddingVertical: 12,
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 12,
},
uploadDatabaseButtonText: {
  fontFamily: 'Poppins-Medium',
  fontSize: 16,
  color: '#FFFFFF',
},
  batchSelectorLabel: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 8,
  },
  batchButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  batchButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedBatchButton: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  batchButtonText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#4B5563',
  },
  selectedBatchButtonText: {
    color: '#6366F1',
    fontFamily: 'Poppins-SemiBold',
  },
  // Rest of index.tsx file styles
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#1F2937',
    marginBottom: 12,
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  selectedDateSchedule: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  selectedDateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedDateText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  attendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  attendanceButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  scheduleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  scheduleTime: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#1F2937',
  },
  batchLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#6B7280',
  },
  scheduleSubject: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#6366F1',
  },
  noScheduleText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 12,
  },
  daySchedule: {
    marginBottom: 16,
  },
  dayTitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 8,
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  subjectCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  subjectName: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#1F2937',
    marginTop: 8,
    textAlign: 'center',
  },
  courseCode: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#6366F1',
  },
  modalTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#FFFFFF',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSubtitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 20,
  },
  imagePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    gap: 8,
  },
  cameraButton: {
    backgroundColor: '#6366F1',
  },
  galleryButton: {
    backgroundColor: '#4B5563',
  },
  actionButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#FFFFFF',
  },
  selectedImagesContainer: {
    marginTop: 12,
  },
  selectedImagesTitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 12,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  imageContainer: {
    width: '31%',
    position: 'relative',
    marginBottom: 10,
  },
  thumbnail: {
    width: '100%',
    height: 100,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  processButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
  },
  processButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
  attendanceResultsContainer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  attendanceResultsTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  attendanceStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  attendanceStat: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    width: '45%',
  },
  presentStat: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  absentStat: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  attendanceStatValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    marginVertical: 4,
  },
  attendanceStatLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#4B5563',
  },
  attendanceListContainer: {
    marginTop: 16,
    gap: 20,
  },
  attendanceListSection: {
    marginBottom: 12,
  },
  attendanceListTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 8,
  },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  studentName: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
  },
  noStudentsText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  newAttendanceButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  newAttendanceButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
  disabledBatchButton: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.6,
  },
  disabledBatchButtonText: {
    color: '#9CA3AF',
  },
  // Add these to your existing styles object:

editedStudentItem: {
  backgroundColor: 'rgba(243, 244, 246, 0.5)',
},
markedPresentItem: {
  backgroundColor: 'rgba(16, 185, 129, 0.1)',
  borderLeftWidth: 3,
  borderLeftColor: '#10B981',
},
markedAbsentItem: {
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  borderLeftWidth: 3,
  borderLeftColor: '#EF4444',
},
editIndicator: {
  marginLeft: 'auto',
},
editText: {
  fontSize: 12,
  fontFamily: 'Poppins-Regular',
  color: '#6B7280',
  fontStyle: 'italic',
},
attendanceActionButtons: {
  gap: 12,
  marginTop: 24,
},
proxyWarningItem: {
  backgroundColor: 'rgba(245, 158, 11, 0.1)', // Amber background for proxy warning
  borderLeftWidth: 3,
  borderLeftColor: '#f59e0b',
},
verificationStatus: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginLeft: 'auto',
  marginRight: 10,
},
verificationLegend: {
  marginTop: 16,
  backgroundColor: '#f8fafc',
  padding: 12,
  borderRadius: 8,
},
legendTitle: {
  fontFamily: 'Poppins-Medium',
  fontSize: 14,
  color: '#1F2937',
  marginBottom: 8,
},
legendItems: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 12,
  marginBottom: 8,
},
legendItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
},
legendText: {
  fontFamily: 'Poppins-Regular',
  fontSize: 12,
  color: '#64748b',
},
detailedVerificationTableContainer: {
  marginTop: 16,
  marginBottom: 16,
},
expandButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#EEF2FF',
  padding: 12,
  borderRadius: 8,
  marginBottom: 8,
},
expandButtonText: {
  fontFamily: 'Poppins-Medium',
  fontSize: 14,
  color: '#6366F1',
  marginRight: 8,
},
courseSelector: {
  marginBottom: 20,
},
courseSelectorLabel: {
  fontFamily: 'Poppins-SemiBold',
  fontSize: 16,
  color: '#1F2937',
  marginBottom: 8,
},
courseButtons: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
},
courseButton: {
  paddingVertical: 8,
  paddingHorizontal: 16,
  backgroundColor: '#F3F4F6',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#E5E7EB',
},
selectedCourseButton: {
  backgroundColor: '#EEF2FF',
  borderColor: '#6366F1',
},
courseButtonText: {
  fontFamily: 'Poppins-Regular',
  fontSize: 14,
  color: '#4B5563',
},
selectedCourseButtonText: {
  color: '#6366F1',
  fontFamily: 'Poppins-SemiBold',
},
// Add these styles to your StyleSheet
downloadReportButton: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#3B82F6',
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: 8,
  gap: 6,
},
downloadReportButtonText: {
  color: '#FFFFFF',
  fontFamily: 'Poppins-Medium',
  fontSize: 12,
},
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
  backgroundColor: '#6366F1',
},
headerDark: {
  backgroundColor: '#4F46E5',
},
content: {
  flex: 1,
  padding: 20,
},
contentDark: {
  backgroundColor: '#1F2937',
},
sectionDark: {
  borderColor: '#374151',
},
sectionTitleDark: {
  color: '#F9FAFB',
},
// Course and Batch selectors
batchSelectorLabel: {
  fontFamily: 'Poppins-SemiBold',
  fontSize: 16,
  color: '#1F2937',
  marginBottom: 8,
},
labelTextDark: {
  color: '#F9FAFB',
},
batchButtonDark: {
  backgroundColor: '#374151',
  borderColor: '#4B5563',
},
batchButtonTextDark: {
  color: '#D1D5DB',
},
selectedBatchButtonDark: {
  backgroundColor: '#4F46E5',
  borderColor: '#818CF8',
},
disabledBatchButtonDark: {
  backgroundColor: '#374151',
  borderColor: '#4B5563',
  opacity: 0.5,
},
disabledBatchButtonTextDark: {
  color: '#9CA3AF',
},
// Course selector
courseButtonDark: {
  backgroundColor: '#374151',
  borderColor: '#4B5563',
},
courseButtonTextDark: {
  color: '#D1D5DB',
},
selectedCourseButtonDark: {
  backgroundColor: '#4338CA',
  borderColor: '#818CF8',
},
// Calendar styles
calendarContainerDark: {
  backgroundColor: '#374151',
  borderColor: '#4B5563',
},
selectedDateScheduleDark: {
  borderTopColor: '#4B5563',
},
selectedDateTextDark: {
  color: '#D1D5DB',
},
scheduleCardDark: {
  backgroundColor: '#374151',
},
scheduleTimeDark: {
  color: '#F9FAFB',
},
batchLabelDark: {
  color: '#9CA3AF',
},
noScheduleTextDark: {
  color: '#9CA3AF',
},
// Day schedule
dayTitleDark: {
  color: '#F9FAFB',
},
// Subject cards
subjectCardDark: {
  backgroundColor: '#374151',
},
subjectNameDark: {
  color: '#F9FAFB',
},
courseCodeDark: {
  color: '#9CA3AF',
},
// Modal styles
modalContainerDark: {
  backgroundColor: '#1F2937',
},
modalHeaderDark: {
  backgroundColor: '#4F46E5',
},
modalContentDark: {
  backgroundColor: '#1F2937',
},
modalSubtitleDark: {
  color: '#F9FAFB',
},
selectedImagesTitleDark: {
  color: '#F9FAFB',
},
// Attendance results
attendanceResultsContainerDark: {
  backgroundColor: '#374151',
},
attendanceResultsTitleDark: {
  color: '#F9FAFB',
},
presentStatDark: {
  backgroundColor: 'rgba(16, 185, 129, 0.2)',
},
absentStatDark: {
  backgroundColor: 'rgba(239, 68, 68, 0.2)',
},
attendanceStatValueDark: {
  color: '#F9FAFB',
},
attendanceStatLabelDark: {
  color: '#D1D5DB',
},
attendanceListTitleDark: {
  color: '#F9FAFB',
},
// Student items
studentItemDark: {
  borderBottomColor: '#374151',
},
studentNameDark: {
  color: '#F9FAFB',
},
editedStudentItemDark: {
  backgroundColor: 'rgba(55, 65, 81, 0.6)',
},
markedPresentItemDark: {
  backgroundColor: 'rgba(16, 185, 129, 0.2)',
  borderLeftColor: '#10B981',
},
markedAbsentItemDark: {
  backgroundColor: 'rgba(239, 68, 68, 0.2)',
  borderLeftColor: '#EF4444',
},
proxyWarningItemDark: {
  backgroundColor: 'rgba(245, 158, 11, 0.2)',
  borderLeftColor: '#f59e0b',
},
editTextDark: {
  color: '#9CA3AF',
},
noStudentsTextDark: {
  color: '#9CA3AF',
},
// Verification legends
verificationLegendDark: {
  backgroundColor: '#374151',
},
legendTitleDark: {
  color: '#F9FAFB',
},
legendTextDark: {
  color: '#D1D5DB',
},
// Expand button
expandButtonDark: {
  backgroundColor: '#374151',
},
expandButtonTextDark: {
  color: '#818CF8',
},
});