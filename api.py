from flask import Flask, request, jsonify
from flask_cors import CORS
import bcrypt
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv
import os
from datetime import datetime,timedelta
# Load env vars
load_dotenv()

app = Flask(__name__)
CORS(app)

# Simple secret key - you can change this to any random string you want
SECRET_KEY = "attendance-system-secret-key-2024"

def connect_to_db():
    client = MongoClient(os.getenv("MONGODB_URI"))
    return client["attendance_system"]

db = connect_to_db()

def authenticate_user(db, username, password):
    user = db.users.find_one({"username": username})
    if not user:
        print("❌ User not found.")
        return False, None
    
    # Check if 'password' field exists
    if 'password' not in user:
        print("⚠️ This user does not have a password set.")
        return False, None
    
    # The stored password is a Binary type, convert to bytes if needed
    stored_hash = user['password']
    if isinstance(stored_hash, bytes):
        hashed_pw = stored_hash
    else:
        hashed_pw = bytes(stored_hash)  # handles Binary type
    
    if bcrypt.checkpw(password.encode('utf-8'), hashed_pw):
        print("✅ Authentication successful.")
        return True, user
    else:
        print("❌ Incorrect password.")
        return False, None
    
# Add these imports at the top of api.py
import pandas as pd
import io
from flask import send_file

@app.route("/attendance/export", methods=["GET"])
def export_attendance():
    """Export attendance record as Excel file"""
    date_str = request.args.get("date")
    batch_id = request.args.get("batch")
    course_id = request.args.get("courseId")
    
    if not date_str or not batch_id:
        return jsonify({"error": "Missing required parameters"}), 400
        
    try:
        # Parse the date string
        target_date = datetime.strptime(date_str, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Find the attendance record
        query = {
            "date": target_date,
            "batchId": batch_id
        }
        
        if course_id:
            query["courseId"] = course_id
            
        attendance = db.attendance.find_one(query)
        
        if not attendance:
            return jsonify({"error": "No attendance record found for the specified date and batch"}), 404
            
        # Create dataframes for present and absent students
        present_data = []
        for student in attendance.get("presentStudents", []):
            verification_data = student.get("verificationData", {})
            face_data = verification_data.get("faceRecognition", {})
            rfid_data = verification_data.get("rfidCheckIn", {})
            
            present_data.append({
                "Roll Number": student.get("rollNo", ""),
                "Name": student.get("name", ""),
                "Status": "Present",
                "Face Recognition": face_data.get("status", False),
                "RFID Check-in": rfid_data.get("status", False),
                "Possible Proxy": verification_data.get("possibleProxy", False),
            })
            
        absent_data = []
        for student in attendance.get("absentStudents", []):
            verification_data = student.get("verificationData", {})
            face_data = verification_data.get("faceRecognition", {})
            rfid_data = verification_data.get("rfidCheckIn", {})
            
            absent_data.append({
                "Roll Number": student.get("rollNo", ""),
                "Name": student.get("name", ""),
                "Status": "Absent",
                "Face Recognition": face_data.get("status", False),
                "RFID Check-in": rfid_data.get("status", False),
                "Possible Proxy": verification_data.get("possibleProxy", False),
            })
            
        # Combine data and create a DataFrame
        all_data = present_data + absent_data
        df = pd.DataFrame(all_data)
        
        # Create an Excel file in memory
        output = io.BytesIO()
        
        # Use ExcelWriter to create a formatted Excel file
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            # Write the main attendance data
            df.to_excel(writer, sheet_name='Attendance', index=False)
            
            # Access the workbook and the worksheet
            workbook = writer.book
            worksheet = writer.sheets['Attendance']
            
            # Add a summary sheet with course information
            summary_data = {
                'Date': [date_str],
                'Batch': [batch_id],
                'Course Name': [attendance.get('courseName', 'N/A')],
                'Course ID': [attendance.get('courseId', 'N/A')],
                'Total Students': [len(all_data)],
                'Present': [attendance.get('totalPresent', len(present_data))],
                'Absent': [attendance.get('totalAbsent', len(absent_data))],
                'Faculty Name': [attendance.get('facultyName', 'N/A')],
                'Faculty ID': [attendance.get('facultyId', 'N/A')]
            }
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='Summary', index=False)
            
            # Access the summary worksheet
            summary_worksheet = writer.sheets['Summary']
            
            # Format the headers in both worksheets
            header_format = workbook.add_format({
                'bold': True,
                'text_wrap': True,
                'valign': 'top',
                'fg_color': '#D9D9D9',
                'border': 1
            })
            
            # Format the attendance data
            present_format = workbook.add_format({
                'bg_color': '#E2F0D9',  # Light green
                'border': 1
            })
            
            absent_format = workbook.add_format({
                'bg_color': '#FBE5D6',  # Light red/orange
                'border': 1
            })
            
            # Write the column headers with the header format
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
                
            # Format rows based on attendance status
            for row_num, row in enumerate(df.values):
                status = row[2]  # Status column (0-indexed)
                row_format = present_format if status == "Present" else absent_format
                
                for col_num, value in enumerate(row):
                    worksheet.write(row_num + 1, col_num, value, row_format)
                
            # Format the summary sheet headers
            for col_num, value in enumerate(summary_df.columns.values):
                summary_worksheet.write(0, col_num, value, header_format)
                
            # Auto-adjust columns' width in both worksheets
            for i, col in enumerate(df.columns):
                column_len = max(df[col].astype(str).map(len).max(), len(col) + 2)
                worksheet.set_column(i, i, column_len)
                
            for i, col in enumerate(summary_df.columns):
                column_len = max(summary_df[col].astype(str).map(len).max(), len(col) + 2)
                summary_worksheet.set_column(i, i, column_len)
        
        # Rewind the buffer
        output.seek(0)
        
        # Generate filename that includes course name
        course_name = attendance.get('courseName', 'Unknown').replace(' ', '_')
        filename = f"attendance_{batch_id}_{course_name}_{date_str}.xlsx"
        
        # Send the file
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        import traceback
        print(f"Error exporting attendance: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"Error generating Excel report: {str(e)}"}), 500

@app.route("/auth", methods=["POST"])
def authenticate():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400
    
    is_authenticated, user = authenticate_user(db, username, password)
    
    if is_authenticated and user:
        # Return user info without JWT
        return jsonify({
            "username": username,
            "name": user.get("name", username),
            "role": user.get("role", "user"),
            # A simple token is just the username and timestamp
            "token": f"{username}_{os.urandom(8).hex()}"
        }), 200
    else:
        return jsonify({"message": "Invalid credentials"}), 401

@app.route("/schedule/<username>", methods=["GET"])
def get_schedule(username):
    user = db.users.find_one({"username": username})
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    # Check if schedule exists in user document
    if "schedule" not in user:
        return jsonify({"message": "No schedule found for this user", "schedule": {}}), 200
    
    # Return the schedule with batch information
    return jsonify({
        "schedule": user.get("schedule", {})
    }), 200

@app.route("/assignedCourses/<username>", methods=["GET"])
def get_assigned_courses(username):
    user = db.users.find_one({"username": username})
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    # Get list of assigned course IDs
    assigned_course_ids = user.get("assignedCourses", [])
    if not assigned_course_ids:
        return jsonify({"courses": []}), 200
    
    # Convert string IDs to ObjectId
    object_ids = []
    for course_id in assigned_course_ids:
        try:
            if isinstance(course_id, str):
                object_ids.append(ObjectId(course_id))
            else:
                object_ids.append(course_id)
        except Exception as e:
            print(f"Error converting ID {course_id}: {e}")
    
    # Fetch course details from the courses collection
    courses = list(db.courses.find({"_id": {"$in": object_ids}}))
    
    # Convert ObjectId to string for JSON serialization
    courses_data = []
    for course in courses:
        course_data = {
            "id": str(course["_id"]),
            "courseName": course.get("courseName", ""),
            "courseCode": course.get("courseCode", "")
        }
        courses_data.append(course_data)
    
    return jsonify({"courses": courses_data}), 200


#---------------------------------------------------------------------------------------
@app.route("/attendance/sessions/<session_id>/results", methods=["POST"])
def update_attendance_session_results(session_id):
    """Update an attendance session with results"""
    data = request.json
    
    # Extract the data
    present_students = data.get("presentStudents", [])
    absent_students = data.get("absentStudents", [])
    verification_data = data.get("verificationData", {})
    
    try:
        # Update the session document with the results
        db.attendanceSessions.update_one(
            {"_id": ObjectId(session_id)},
            {
                "$set": {
                    "status": "completed",
                    "presentStudents": present_students,
                    "absentStudents": absent_students,
                    "totalPresent": len(present_students),
                    "totalAbsent": len(absent_students),
                    "verificationData": verification_data,  # Save verification data
                    "completedAt": datetime.now()
                }
            }
        )
        
        # Create or update attendance record for this date, batch and course
        attendance_record = {
            "date": datetime.strptime(data.get("date"), "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0),
            "batchId": data.get("batchId"),
            "courseId": data.get("courseId"),
            "courseName": data.get("courseName"),
            "facultyId": data.get("facultyId"),
            "facultyName": data.get("facultyName"),
            "presentStudents": present_students,
            "absentStudents": absent_students,
            "totalPresent": len(present_students),
            "totalAbsent": len(absent_students),
            "verificationData": verification_data,  # Save verification data
            "updatedAt": datetime.now()
        }
        
        # Check if record exists for this date, batch and course
        existing_record = db.attendance.find_one({
            "date": attendance_record["date"],
            "batchId": attendance_record["batchId"],
            "courseId": attendance_record["courseId"]
        })
        
        if existing_record:
            # Update existing record
            db.attendance.update_one(
                {"_id": existing_record["_id"]},
                {"$set": attendance_record}
            )
        else:
            # Insert new record
            attendance_record["createdAt"] = datetime.now()
            db.attendance.insert_one(attendance_record)
            
        return jsonify({
            "message": "Attendance updated successfully",
            "sessionId": session_id
        }), 200
        
    except Exception as e:
        print(f"Error updating attendance session: {e}")
        return jsonify({"error": f"Failed to update attendance: {str(e)}"}), 500

@app.route("/attendance/marked-dates", methods=["GET"])
def get_marked_attendance_dates():
    """Get dates where attendance records exist for a specific batch, course, and faculty"""
    batch = request.args.get("batch", "A")
    course_id = request.args.get("courseId")  # Parameter for filtering by course
    faculty_id = request.args.get("facultyId")  # New parameter for filtering by faculty
    
    try:
        # Build the query based on provided parameters
        query = {"batchId": batch}  # Using batchId based on your DB schema shown earlier
        
        # Add course filter if provided
        if course_id:
            query["courseId"] = course_id
            
        # Add faculty filter if provided
        if faculty_id:
            query["facultyId"] = faculty_id
        
        # Find all attendance records for this batch, course, and faculty
        attendance_records = db.attendance.find(query, {"date": 1})
        
        # RFID query should also include faculty if available
        rfid_query = {"batch": batch}
        if faculty_id:
            rfid_query["facultyId"] = faculty_id
            
        # For RFID records, we might not have courseId
        rfid_records = db.rfid_attendance.find(rfid_query, {"date": 1})
        
        marked_dates = set()  # Use a set to avoid duplicates
        
        # Process regular attendance records
        for record in attendance_records:
            if "date" in record and record["date"]:
                date_str = record["date"].strftime("%Y-%m-%d")
                marked_dates.add(date_str)
        
        # Process RFID attendance records (only if courseId not specified)
        if not course_id:
            for record in rfid_records:
                if "date" in record and record["date"]:
                    date_str = record["date"].strftime("%Y-%m-%d")
                    marked_dates.add(date_str)
        
        return jsonify({
            "batch": batch,
            "courseId": course_id,
            "facultyId": faculty_id,  # Include faculty ID in response for debugging
            "markedDates": list(marked_dates)
        }), 200
        
    except Exception as e:
        print(f"Error retrieving marked attendance dates: {e}")
        return jsonify({"message": f"Error retrieving marked dates: {str(e)}"}), 500
    
@app.route("/attendance/sessions", methods=["POST"])
def create_attendance_session():
    """Create a new attendance session"""
    try:
        # Get the first professor from the database
        professor = db.users.find_one({"role": "professor"})
        if not professor:
            return jsonify({"message": "No professor found in database"}), 404
            
        # Get the professor's batch and course
        if not professor.get("assignedBatches") or not len(professor["assignedBatches"]) > 0:
            return jsonify({"message": "Professor has no assigned batches"}), 400
            
        batch_id = professor["assignedBatches"][0]
        
        # Get course from assignedCourses or find one
        if professor.get("assignedCourses") and len(professor["assignedCourses"]) > 0:
            course_id = professor["assignedCourses"][0]
        else:
            # Find a course that has this batch assigned
            course = db.courses.find_one({"assignedBatches": batch_id})
            if not course:
                return jsonify({"message": "No course found for this batch"}), 404
            course_id = course["_id"]
        
        # Create a new session
        session = {
            "date": datetime.now(),
            "startTime": datetime.now(),
            "endTime": None,
            "batchId": batch_id,
            "courseId": course_id,
            "facultyId": professor["_id"],
            "status": "in-progress",
            "capturedImages": [],
            "createdAt": datetime.now(),
            "updatedAt": datetime.now()
        }
        
        result = db.attendanceSessions.insert_one(session)
        
        return jsonify({
            "message": "Attendance session created",
            "sessionId": str(result.inserted_id)
        }), 201
        
    except Exception as e:
        print(f"Error creating attendance session: {e}")
        return jsonify({"message": f"Error creating session: {str(e)}"}), 500

# @app.route("/rfid/attendance", methods=["POST"])
# def process_rfid_attendance():
#     """Process RFID scan for attendance"""
#     data = request.json
#     rfid_tag = data.get("rfid_tag")
    
#     if not rfid_tag:
#         return jsonify({"message": "RFID tag is required"}), 400
    
#     try:
#         # Find the student by RFID tag
#         student = db.students.find_one({"rfidTag": rfid_tag})
#         if not student:
#             return jsonify({"message": "No student found with this RFID tag"}), 404
        
#         # Get the latest session
#         session = db.attendanceSessions.find_one(
#             {"status": "in-progress"},
#             sort=[("createdAt", -1)]
#         )
        
#         if not session:
#             return jsonify({"message": "No active attendance session found"}), 404
        
#         # Find or create the attendance record for this session
#         attendance_record = db.attendance.find_one({
#             "date": session["date"].replace(hour=0, minute=0, second=0, microsecond=0),
#             "batchId": session["batchId"]
#         })
        
#         if not attendance_record:
#             # Create a new attendance record if it doesn't exist
#             attendance_record = {
#                 "date": session["date"].replace(hour=0, minute=0, second=0, microsecond=0),
#                 "batchId": session["batchId"],
#                 "attendanceRecords": [],
#                 "createdAt": datetime.now(),
#                 "updatedAt": datetime.now()
#             }
#             db.attendance.insert_one(attendance_record)
#             attendance_record = db.attendance.find_one({
#                 "date": session["date"].replace(hour=0, minute=0, second=0, microsecond=0),
#                 "batchId": session["batchId"]
#             })
        
#         # Check if student already has an attendance record
#         student_record = None
#         for record in attendance_record.get("attendanceRecords", []):
#             if str(record.get("studentId")) == str(student["_id"]):
#                 student_record = record
#                 break
        
#         if student_record:
#             # Update existing record
#             db.attendance.update_one(
#                 {"_id": attendance_record["_id"], "attendanceRecords.studentId": student["_id"]},
#                 {"$set": {
#                     "attendanceRecords.$.rfidCheckIn.timestamp": datetime.now(),
#                     "attendanceRecords.$.rfidCheckIn.status": True,
#                     "updatedAt": datetime.now()
#                 }}
#             )
#         else:
#             # Add new record for this student
#             db.attendance.update_one(
#                 {"_id": attendance_record["_id"]},
#                 {"$push": {
#                     "attendanceRecords": {
#                         "studentId": student["_id"],
#                         "rfidCheckIn": {
#                             "timestamp": datetime.now(),
#                             "status": True
#                         },
#                         "faceRecognition": {
#                             "status": False,
#                             "confidence": 0
#                         },
#                         "isPresent": False,
#                         "isProxy": False
#                     }
#                 },
#                 "$set": {"updatedAt": datetime.now()}}
#             )
        
#         return jsonify({
#             "message": "Attendance recorded successfully",
#             "student": {
#                 "id": str(student["_id"]),
#                 "name": student.get("name", ""),
#                 "rollNo": student.get("rollNo", "")
#             }
#         }), 200
        
#     except Exception as e:
#         print(f"Error processing RFID attendance: {e}")
#         return jsonify({"message": f"Error processing attendance: {str(e)}"}), 500

# Add this somewhere after the app = Flask(__name__) line
@app.route("/", methods=["GET"])
def root():
    """Root endpoint to check if the API is running"""
    return jsonify({
        "status": "online",
        "message": "AttendX API is running",
        "version": "1.0"
    })

# @app.route("/rfid/attendance", methods=["POST"])
# def process_rfid_attendance():
#     """Process RFID scan for attendance without requiring an active session"""
#     data = request.json
#     rfid_tag = data.get("rfid_tag")
#     batch = data.get("batch", "A")  # Default to batch A if not specified
    
#     if not rfid_tag:
#         return jsonify({"message": "RFID tag is required"}), 400
    
#     try:
#         # Find the student by RFID tag
#         student = db.students.find_one({"rfidTag": rfid_tag})
#         if not student:
#             return jsonify({"message": "No student found with this RFID tag"}), 404
        
#         # Format for today's date (YYYY-MM-DD format)
#         today_str = datetime.now().strftime("%Y-%m-%d")
#         today_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
#         current_time = datetime.now()
#         student_id_str = str(student["_id"])
        
#         # Find or create the attendance record for today
#         daily_record = db.attendance.find_one({
#             "date": today_date,
#             "type": "daily",
#             "batch": batch
#         })
        
#         if not daily_record:
#             # Create a new daily attendance record with this student
#             daily_record = {
#                 "date": today_date,
#                 "type": "daily",  # Mark as a daily record
#                 "batch": batch,
#                 "students": {
#                     student_id_str: {
#                         "id": student_id_str,
#                         "name": student.get("name", ""),
#                         "rollNo": student.get("rollNo", ""),
#                         "rfidCheckIn": {
#                             "timestamp": current_time,
#                             "status": True
#                         },
#                         "isPresent": True
#                     }
#                 },
#                 "createdAt": current_time,
#                 "updatedAt": current_time
#             }
#             db.attendance.insert_one(daily_record)
            
#         else:
#             # Update the existing daily record to include this student
#             students_data = daily_record.get("students", {})
            
#             # Update or add this student
#             students_data[student_id_str] = {
#                 "id": student_id_str,
#                 "name": student.get("name", ""),
#                 "rollNo": student.get("rollNo", ""),
#                 "rfidCheckIn": {
#                     "timestamp": current_time,
#                     "status": True
#                 },
#                 "isPresent": True
#             }
            
#             # Update the record
#             db.attendance.update_one(
#                 {"_id": daily_record["_id"]},
#                 {
#                     "$set": {
#                         "students": students_data,
#                         "updatedAt": current_time
#                     }
#                 }
#             )
        
#         return jsonify({
#             "message": "Attendance recorded successfully",
#             "student": {
#                 "id": student_id_str,
#                 "name": student.get("name", ""),
#                 "rollNo": student.get("rollNo", "")
#             },
#             "batch": batch,
#             "date": today_str,
#             "timestamp": current_time.isoformat()
#         }), 200
        
#     except Exception as e:
#         print(f"Error processing RFID attendance: {e}")
#         return jsonify({"message": f"Error processing attendance: {str(e)}"}), 500
@app.route("/rfid/attendance", methods=["POST"])
def process_rfid_attendance():
    """Process RFID scan for attendance with manual date entry"""
    data = request.json
    rfid_tag = data.get("rfid_tag")
    batch = data.get("batch", "A")  # Default to batch A if not specified
    
    # Add support for manual date entry
    date_str = data.get("date")
    if date_str:
        try:
            # Parse provided date
            manual_date = datetime.strptime(date_str, "%Y-%m-%d")
            today_date = manual_date.replace(hour=0, minute=0, second=0, microsecond=0)
            today_str = date_str
        except ValueError:
            return jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400
    else:
        # Use current date if none provided
        today_str = datetime.now().strftime("%Y-%m-%d")
        today_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    current_time = datetime.now()
    
    if not rfid_tag:
        return jsonify({"message": "RFID tag is required"}), 400
    
    try:
        # Find the student by RFID tag
        student = db.students.find_one({"rfidTag": rfid_tag})
        if not student:
            return jsonify({"message": "No student found with this RFID tag"}), 404
        
        student_id_str = str(student["_id"])
        
        # Student data to record
        student_record = {
            "studentId": student_id_str,
            "rfidTag": rfid_tag,
            "name": student.get("name", ""),
            "rollNo": student.get("rollNo", ""),
            "timestamp": current_time,
            "attendance_status": "present"
        }
        
        # Find or create a document for this date and batch
        rfid_day_record = db.rfid_attendance.find_one({
            "date": today_date,
            "batch": batch
        })
        
        if not rfid_day_record:
            # Create a new document for this date and batch
            rfid_day_record = {
                "date": today_date,
                "batch": batch,
                "students": [student_record],
                "createdAt": current_time,
                "updatedAt": current_time
            }
            db.rfid_attendance.insert_one(rfid_day_record)
        else:
            # Check if student already marked for today
            student_exists = False
            for existing_student in rfid_day_record.get("students", []):
                if existing_student.get("studentId") == student_id_str:
                    student_exists = True
                    break
            
            if not student_exists:
                # Add this student to the existing document
                db.rfid_attendance.update_one(
                    {"_id": rfid_day_record["_id"]},
                    {
                        "$push": {"students": student_record},
                        "$set": {"updatedAt": current_time}
                    }
                )
            else:
                # Update the existing student record
                db.rfid_attendance.update_one(
                    {
                        "_id": rfid_day_record["_id"],
                        "students.studentId": student_id_str
                    },
                    {
                        "$set": {
                            "students.$.timestamp": current_time,
                            "updatedAt": current_time
                        }
                    }
                )
        
        # Also update the regular attendance record for compatibility
        daily_record = db.attendance.find_one({
            "date": today_date,
            "type": "daily",
            "batch": batch
        })
        
        if not daily_record:
            # Create a new daily attendance record with this student
            daily_record = {
                "date": today_date,
                "type": "daily",
                "batch": batch,
                "students": {
                    student_id_str: {
                        "id": student_id_str,
                        "name": student.get("name", ""),
                        "rollNo": student.get("rollNo", ""),
                        "rfidCheckIn": {
                            "timestamp": current_time,
                            "status": True
                        },
                        "isPresent": True
                    }
                },
                "createdAt": current_time,
                "updatedAt": current_time
            }
            db.attendance.insert_one(daily_record)
        else:
            # Update existing record
            students_data = daily_record.get("students", {})
            students_data[student_id_str] = {
                "id": student_id_str,
                "name": student.get("name", ""),
                "rollNo": student.get("rollNo", ""),
                "rfidCheckIn": {
                    "timestamp": current_time,
                    "status": True
                },
                "isPresent": True
            }
            
            db.attendance.update_one(
                {"_id": daily_record["_id"]},
                {
                    "$set": {
                        "students": students_data,
                        "updatedAt": current_time
                    }
                }
            )
        
        return jsonify({
            "message": "Attendance recorded successfully",
            "student": {
                "id": student_id_str,
                "name": student.get("name", ""),
                "rollNo": student.get("rollNo", "")
            },
            "batch": batch,
            "date": today_str,
            "manual_entry": date_str is not None,
            "timestamp": current_time.isoformat()
        }), 200
        
    except Exception as e:
        print(f"Error processing RFID attendance: {e}")
        return jsonify({"message": f"Error processing attendance: {str(e)}"}), 500
    

@app.route("/rfid/records", methods=["GET"])
def get_rfid_records():
    """Get RFID attendance records with optional date filtering"""
    date_str = request.args.get("date")
    batch = request.args.get("batch")
    
    query = {}
    
    if date_str:
        try:
            # Parse date and create a date range for the entire day
            target_date = datetime.strptime(date_str, "%Y-%m-%d")
            start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = start_of_day + timedelta(days=1)
            
            # Create a query that matches the date part only, ignoring time
            query["date"] = {
                "$gte": start_of_day,
                "$lt": end_of_day
            }
        except ValueError:
            return jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400
    
    if batch:
        query["batch"] = batch
    
    try:
        records = list(db.rfid_attendance.find(query))
        
        # Process records for JSON serialization
        result = []
        for record in records:
            # Convert ObjectId to string
            record["_id"] = str(record["_id"])
            
            # Convert datetime objects to strings
            if "date" in record:
                record["date"] = record["date"].strftime("%Y-%m-%d")
            if "createdAt" in record:
                record["createdAt"] = record["createdAt"].isoformat()
            if "updatedAt" in record:
                record["updatedAt"] = record["updatedAt"].isoformat()
                
            # Format timestamps for each student
            students = record.get("students", [])
            for student in students:
                if "timestamp" in student:
                    student["timestamp"] = student["timestamp"].isoformat()
            
            result.append(record)
        
        # Get a flattened list of all students for compatibility with previous format
        flat_students = []
        for record in result:
            date = record.get("date")
            batch = record.get("batch")
            for student in record.get("students", []):
                student_copy = student.copy()
                student_copy["date"] = date
                student_copy["batch"] = batch
                flat_students.append(student_copy)
        
        return jsonify({
            "count": len(flat_students),
            "records": flat_students,
            "daily_records": result
        }), 200
    except Exception as e:
        return jsonify({"message": f"Error retrieving RFID records: {str(e)}"}), 500

#--------------------------------------------------------------------------------
@app.route("/attendance/daily", methods=["GET"])
def get_daily_attendance():
    """Get attendance record for a specific date and batch"""
    date_str = request.args.get("date", datetime.now().strftime("%Y-%m-%d"))
    batch = request.args.get("batch", "A")
    
    try:
        # Convert string date to datetime object for query
        query_date = datetime.strptime(date_str, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
        
        daily_record = db.attendance.find_one({
            "date": query_date,
            "type": "daily",
            "batch": batch
        })
        
        if not daily_record:
            return jsonify({
                "message": f"No attendance record found for date {date_str} and batch {batch}",
                "date": date_str,
                "batch": batch,
                "students": {}
            }), 404
        
        # Convert ObjectId to string for JSON serialization
        daily_record["_id"] = str(daily_record["_id"])
        daily_record["date"] = date_str  # Convert datetime to string for response
        
        return jsonify(daily_record), 200
        
    except Exception as e:
        print(f"Error retrieving daily attendance: {e}")
        return jsonify({"message": f"Error retrieving attendance: {str(e)}"}), 500

@app.route("/attendance/student/<student_id>", methods=["GET"])
def get_student_attendance(student_id):
    """Get attendance records for a specific student across dates"""
    try:
        # Find all attendance records that include this student
        attendance_records = list(db.attendance.find({
            "type": "daily",
            f"students.{student_id}": {"$exists": True}
        }).sort("date", -1))
        
        if not attendance_records:
            return jsonify({
                "message": f"No attendance records found for student {student_id}",
                "studentId": student_id,
                "records": []
            }), 404
        
        # Format the records for response
        formatted_records = []
        for record in attendance_records:
            formatted_records.append({
                "date": record["date"].strftime("%Y-%m-%d"),
                "batch": record["batch"],
                "status": record["students"][student_id]["isPresent"],
                "checkInTime": record["students"][student_id].get("rfidCheckIn", {}).get("timestamp")
            })
        
        return jsonify({
            "studentId": student_id,
            "records": formatted_records
        }), 200
        
    except Exception as e:
        print(f"Error retrieving student attendance: {e}")
        return jsonify({"message": f"Error retrieving attendance: {str(e)}"}), 500

@app.route("/attendance/verify", methods=["POST"])
def verify_attendance():
    """Verify attendance by cross-checking facial recognition with RFID records"""
    try:
        data = request.json
        date_str = data.get("date")
        batch_id = data.get("batch")
        course_id = data.get("courseId")  # Add courseId parameter

        recognized_students = data.get("recognizedStudents", [])
        
        if not date_str or not batch_id:
            return jsonify({"error": "Missing required parameters"}), 400
            
        # Use the approach that works in your test script
        try:
            # Parse date string as YYYY-MM-DD
            query_date = datetime.strptime(date_str, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
            print(f"Searching for RFID records for date: {query_date}")
        except Exception as e:
            print(f"Date parsing error: {e}")
            return jsonify({"error": f"Invalid date format: {e}"}), 400
        
        # First try the exact match approach (Approach 1 from your test)
        rfid_record = db.rfid_attendance.find_one({
            "date": query_date,
            "batch": batch_id
        })
        
        # If not found, try the date range approach (Approach 2 from your test)
        if not rfid_record:
            print("Exact match not found, trying date range query...")
            rfid_record = db.rfid_attendance.find_one({
                "date": {
                    "$gte": query_date,
                    "$lt": query_date + timedelta(days=1)
                },
                "batch": batch_id
            })
        
        # If still not found, try the manual approach (Approach 3 from your test)
        if not rfid_record:
            print("Date range query failed, trying manual filtering...")
            all_records = list(db.rfid_attendance.find({"batch": batch_id}))
            print(f"Found {len(all_records)} total records for batch {batch_id}")
            
            for record in all_records:
                record_date = record.get("date")
                if record_date:
                    if (record_date.year == query_date.year and 
                        record_date.month == query_date.month and 
                        record_date.day == query_date.day):
                        print(f"Match found manually: {record_date}")
                        rfid_record = record
                        break
        
        print(f"RFID record found: {rfid_record is not None}")
        
        # Debug output of RFID data
        if rfid_record:
            print(f"Record date: {rfid_record.get('date')}")
            rfid_students = rfid_record.get("students", [])
            print(f"Found {len(rfid_students)} students in RFID record")
            if rfid_students:
                print(f"First RFID student: {rfid_students[0].get('rollNo')}, {rfid_students[0].get('name')}")
        
        # Extract roll numbers from face recognition results
        face_recognized_roll_numbers = []
        face_name_map = {}
        for student_str in recognized_students:
            parts = student_str.split('_')
            roll_no = parts[0]
            name = parts[1] if len(parts) > 1 else ""
            face_recognized_roll_numbers.append(roll_no)
            face_name_map[roll_no] = name
        
        print(f"Face recognized rolls: {face_recognized_roll_numbers}")
        
        # Extract roll numbers from RFID records
        rfid_roll_numbers = []
        rfid_name_map = {}
        if rfid_record and "students" in rfid_record:
            for rfid_student in rfid_record.get("students", []):
                roll_no = rfid_student.get("rollNo")
                if roll_no:  # Only add if roll number exists
                    rfid_roll_numbers.append(roll_no)
                    rfid_name_map[roll_no] = rfid_student.get("name", "")
        
        print(f"RFID rolls: {rfid_roll_numbers}")
        
        # Initialize result dictionary
        result = {
            "date": date_str,
            "batch": batch_id,
            "students": {}
        }
        
        # Get all students in the batch (to include absent students)
        try:
            all_batch_students = list(db.students.find({"batch": batch_id}))
            for student in all_batch_students:
                roll_no = student.get("rollNo")
                name = student.get("name", "")
                
                # Only add if not already processed
                if roll_no and roll_no not in result["students"]:
                    face_detected = roll_no in face_recognized_roll_numbers
                    rfid_detected = roll_no in rfid_roll_numbers
                    
                    result["students"][roll_no] = {
                        "rollNo": roll_no,
                        "name": name,
                        "faceRecognition": {"status": face_detected},
                        "rfidCheckIn": {"status": rfid_detected},
                        "isPresent": face_detected and rfid_detected,
                        "possibleProxy": rfid_detected and not face_detected
                    }
        except Exception as e:
            print(f"Error fetching batch students: {e}")
        
        # Process face recognition results
        for student_str in recognized_students:
            parts = student_str.split('_')
            roll_no = parts[0]
            name = parts[1] if len(parts) > 1 else ""
            
            # Create or update student entry
            if roll_no in result["students"]:
                result["students"][roll_no].update({
                    "faceRecognition": {"status": True},
                    "isPresent": roll_no in rfid_roll_numbers,
                    "possibleProxy": False
                })
            else:
                result["students"][roll_no] = {
                    "rollNo": roll_no,
                    "name": name,
                    "faceRecognition": {"status": True},
                    "rfidCheckIn": {"status": roll_no in rfid_roll_numbers},
                    "isPresent": roll_no in rfid_roll_numbers,  # Present only if both are true
                    "possibleProxy": False
                }
        
        # Process RFID records for students not captured by face recognition
        if rfid_record and "students" in rfid_record:
            for rfid_student in rfid_record.get("students", []):
                roll_no = rfid_student.get("rollNo")
                name = rfid_student.get("name", "")
                
                if not roll_no:
                    continue  # Skip if roll number is missing
                
                if roll_no not in result["students"]:
                    # Student has RFID record but not face recognition - possible proxy
                    result["students"][roll_no] = {
                        "rollNo": roll_no,
                        "name": name,
                        "faceRecognition": {"status": False},
                        "rfidCheckIn": {"status": True},
                        "isPresent": False,  # Not present due to no face recognition
                        "possibleProxy": True  # This is a proxy case!
                    }
                elif roll_no in result["students"] and not result["students"][roll_no]["faceRecognition"]["status"]:
                    # Update existing entry to mark as possible proxy
                    result["students"][roll_no]["possibleProxy"] = True
                    result["students"][roll_no]["rfidCheckIn"]["status"] = True
                    
        # Convert results to a format that supports both present and absent lists
        face_recognized = sorted([s for s in recognized_students])
        present_students = []
        absent_students = []
        possible_proxy_students = []
        
        # Create student output lists
        for roll_no, student_data in result["students"].items():
            student_str = f"{roll_no}_{student_data['name']}"
            
            if student_data["possibleProxy"]:
                possible_proxy_students.append(student_str)
                absent_students.append(student_str)  # Also counted as absent
            elif student_data["isPresent"]:
                present_students.append(student_str)
            else:
                absent_students.append(student_str)
        
        # Add the output lists to the result
        result["output"] = {
            "present": present_students,
            "absent": absent_students,
            "possibleProxy": possible_proxy_students,
            "face_recognized": face_recognized
        }
        
        result["courseId"] = course_id
        
        return jsonify(result), 200
        
    except Exception as e:
        import traceback
        print(f"Error verifying attendance: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"Error verifying attendance: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)




 #---------------------------------------------------------------   
# from flask import Flask, request, jsonify
# from flask_cors import CORS
# import bcrypt
# from pymongo import MongoClient
# import os
# import jwt
# from datetime import datetime, timedelta

# app = Flask(__name__)
# CORS(app)

# # Configure MongoDB
# client = MongoClient(os.getenv("MONGODB_URI"))
# db = client["attendance_system"]

# # Secret for JWT
# JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")

# @app.route("/auth", methods=["POST"])
# def authenticate():
#     data = request.json
#     username = data.get("username")
#     password = data.get("password")
    
#     if not username or not password:
#         return jsonify({"message": "Username and password are required"}), 400
    
#     user = db.users.find_one({"username": username})
#     if not user:
#         return jsonify({"message": "User not found"}), 404
    
#     if 'password' not in user:
#         return jsonify({"message": "Password not set for this user"}), 400
    
#     # Get the stored password hash
#     stored_hash = user['password']
#     if isinstance(stored_hash, bytes):
#         hashed_pw = stored_hash
#     else:
#         hashed_pw = bytes(stored_hash)
    
#     # Verify password
#     if bcrypt.checkpw(password.encode('utf-8'), hashed_pw):
#         # Generate JWT token
#         token = jwt.encode({
#             "username": username,
#             "role": user.get("role", "user"),
#             "exp": datetime.utcnow() + timedelta(days=7)  # Token expires in 7 days
#         }, JWT_SECRET, algorithm="HS256")
        
#         return jsonify({
#             "username": username,
#             "name": user.get("name", username),
#             "role": user.get("role", "user"),
#             "token": token
#         }), 200
#     else:
#         return jsonify({"message": "Invalid credentials"}), 401

# if __name__ == "__main__":
#     app.run(debug=True)