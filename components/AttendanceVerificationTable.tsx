import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { User, Fingerprint, AlertTriangle, CheckCircle, XCircle } from 'lucide-react-native';

interface AttendanceVerificationTableProps {
  students: Record<string, any>;
  date: string;
  batch: string;
}

export default function AttendanceVerificationTable({ students, date, batch }: AttendanceVerificationTableProps) {
  const { isDarkMode } = useTheme();
  
  // Convert the students object to an array format for FlatList
  const studentsArray = Object.entries(students).map(([rollNo, data]) => ({
    rollNo,
    name: data.name || 'Unknown',
    isPresent: data.isPresent || false,
    rfidCheckIn: data.rfidCheckIn?.status || false,
    faceRecognition: data.faceRecognition?.status || false,
    possibleProxy: data.possibleProxy || false,
  }));

  const renderStatusIcons = (student: any) => {
    return (
      <View style={styles.statusIcons}>
        {/* RFID Status */}
        <View style={[styles.statusIconContainer, isDarkMode && styles.statusIconContainerDark]}>
          <Fingerprint 
            size={16} 
            color={student.rfidCheckIn ? "#22c55e" : "#94a3b8"} 
          />
        </View>
        
        {/* Face Recognition Status */}
        <View style={[styles.statusIconContainer, isDarkMode && styles.statusIconContainerDark]}>
          <User 
            size={16} 
            color={student.faceRecognition ? "#22c55e" : "#94a3b8"} 
          />
        </View>
        
        {/* Proxy Warning */}
        {student.possibleProxy && (
          <View style={[styles.statusIconContainer, isDarkMode && styles.statusIconContainerDark]}>
            <AlertTriangle size={16} color="#f59e0b" />
          </View>
        )}
        
        {/* Present/Absent Status */}
        <View style={[styles.statusIconContainer, isDarkMode && styles.statusIconContainerDark]}>
          {student.isPresent ? (
            <CheckCircle size={16} color="#22c55e" />
          ) : (
            <XCircle size={16} color="#ef4444" />
          )}
        </View>
      </View>
    );
  };
  
  const getRowBgColor = (student: any) => {
    if (student.possibleProxy) return isDarkMode ? styles.proxyRowDark : styles.proxyRow;
    if (student.isPresent) return isDarkMode ? styles.presentRowDark : styles.presentRow;
    return isDarkMode ? styles.absentRowDark : styles.absentRow;
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.row, getRowBgColor(item)]}>
      <Text style={[styles.rollNo, isDarkMode && styles.textDark]}>{item.rollNo}</Text>
      <Text style={[styles.name, isDarkMode && styles.textDark]}>{item.name}</Text>
      <View style={styles.status}>
        {renderStatusIcons(item)}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <Text style={[styles.title, isDarkMode && styles.titleDark]}>Attendance with Verification</Text>
        <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>{`${date} - Batch ${batch}`}</Text>
      </View>
      
      <View style={[styles.legendContainer, isDarkMode && styles.legendContainerDark]}>
        <Text style={[styles.legendTitle, isDarkMode && styles.legendTitleDark]}>Legend:</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <Fingerprint size={14} color="#22c55e" />
            <Text style={[styles.legendText, isDarkMode && styles.legendTextDark]}>RFID Check-in</Text>
          </View>
          <View style={styles.legendItem}>
            <User size={14} color="#22c55e" />
            <Text style={[styles.legendText, isDarkMode && styles.legendTextDark]}>Face Recognized</Text>
          </View>
          <View style={styles.legendItem}>
            <AlertTriangle size={14} color="#f59e0b" />
            <Text style={[styles.legendText, isDarkMode && styles.legendTextDark]}>Possible Proxy</Text>
          </View>
        </View>
      </View>
      
      <View style={[styles.tableHeader, isDarkMode && styles.tableHeaderDark]}>
        <Text style={[styles.headerCell, styles.rollNoHeader, isDarkMode && styles.headerCellDark]}>Roll No</Text>
        <Text style={[styles.headerCell, styles.nameHeader, isDarkMode && styles.headerCellDark]}>Name</Text>
        <Text style={[styles.headerCell, styles.statusHeader, isDarkMode && styles.headerCellDark]}>Status</Text>
      </View>
      
      <FlatList
        data={studentsArray}
        renderItem={renderItem}
        keyExtractor={(item) => item.rollNo}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  containerDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  header: {
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#4B5563',
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#1F2937',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  legendContainer: {
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  legendContainerDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#4B5563',
  },
  legendTitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
  },
  legendTitleDark: {
    color: '#9CA3AF',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#6B7280',
  },
  legendTextDark: {
    color: '#D1D5DB',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#4B5563',
  },
  headerCell: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#4B5563',
  },
  headerCellDark: {
    color: '#9CA3AF',
  },
  rollNoHeader: {
    flex: 1,
  },
  nameHeader: {
    flex: 2,
  },
  statusHeader: {
    flex: 1,
    textAlign: 'center',
  },
  list: {
    maxHeight: 300,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  presentRow: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  presentRowDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderBottomColor: '#374151',
  },
  absentRow: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  absentRowDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderBottomColor: '#374151',
  },
  proxyRow: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  proxyRowDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderBottomColor: '#374151',
  },
  rollNo: {
    flex: 1,
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#1F2937',
  },
  name: {
    flex: 2,
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#1F2937',
  },
  textDark: {
    color: '#F9FAFB',
  },
  status: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statusIcons: {
    flexDirection: 'row',
    gap: 6,
  },
  statusIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconContainerDark: {
    backgroundColor: '#4B5563',
  },
});