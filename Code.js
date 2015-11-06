function onInstall(e) {
	onOpen();
}

function onOpen() {
  SpreadsheetApp.getUi() // Or DocumentApp or FormApp.
      .createMenu('Doctopus Folder Embedder')
      .addItem('Get Rosters to Embed', 'showSidebar')
      .addToUi();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Roster Selector')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setTitle('Doctopus Embedder')
      .setWidth(300);
  SpreadsheetApp.getUi() // Or DocumentApp or FormApp.
    .showSidebar(html);
}

function doGet(e) {
  var html = HtmlService.createTemplateFromFile('Roster Selector');
  return html.evaluate().setSandboxMode(HtmlService.SandboxMode.IFRAME);
} 

function showAlert (title, msg) {
	var ui = SpreadsheetApp.getUi(); // Same variations.
	ui.alert(title,msg);
}

function confirmAction (title, message) {
  var ui = SpreadsheetApp.getUi(); // Same variations.
  var result = ui.alert(
		title,
		message,
    ui.ButtonSet.OK_CANCEL);
  // Process the user's response.
  if (result == ui.Button.OK) {
    // User clicked "Yes".
    //ui.alert('Confirmation received.');
		return true
  } else {
    // User clicked "No" or X in the title bar.
    return false
  }
}

function embedFoldersFromSheet () {
	var sheet = SpreadsheetApp.getActiveSheet();
	var range = sheet.getDataRange();
	var row = range.getValues()[0]
	// Double-check that things look right...
	if (row[0]=='First' && 
			row[1]=='Last' && 
			row[2]=='Email' &&
			row[3].indexOf('Child Folder') > -1 &&
			row[4].indexOf('Parent Folder') > -1 && 
			row[5]=='Exclude'
		 ) {
		// Ok -- let's do this thing...
		if 	(confirmAction(
			'Embed folders?',
			'Put student folders from "'+row[3]+'" inside of folders from "'+row[4]+'?')) {
			if (row[6] != 'Completed') {
				sheet.getRange(1,6).setValue('Completed'); // Set up row to track if we are done yet...
			}
			range.getValues().forEach( function (row,idx) {
				if (idx!=0) {
					if (row[5] != 'Exclude' && row[6] != 'Done') {
						try {
							parentFolder = DriveApp.getFolderById(row[4])
							childFolder = DriveApp.getFolderById(row[3])
							parentFolder.addFolder(childFolder);
							range.getCell(idx+1,7).setValue('Done');
						}
						catch (err) {
							cell = range.getCell(idx+1,7)
							cell.setValue(JSON.stringify(err));
							cell.setFontColor('#ff0000');
						} // end try/catch
					} // end if not excluded or done
				} // end if not header row
			} 
															 )// end forEach row
		} // end if confirmed
		else {
			showAlert('Cancelled','Not moving folders after all: you cancelled the action.');
		}
	} // end if things look good
	else { // else if things look borked...
		Logger.log('Data looks fishy...');
		Logger.log('Row: '+JSON.stringify(row));
		showAlert('Not ready','Spreadsheet does not appear to have roster data loaded. Make sure you\'ve selected rosters and clicked "Load Rosters."');
		throw "Header row doesn't look right. Maybe try re-loading rosters?";
	} // end else
}

function updateRostersOnSheet (childRosterObj, parentRosterObj) {
	toPush = [] // An array of students to push...
	childRosterObj.students.forEach(
		function (childStudent) {
			parentRosterObj.students.forEach(
				function(parentStudent) {
					if (parentStudent.email==childStudent.email) {
						toPush.push([childStudent,parentStudent])
					}
				}
			) // end forEach parentStudent
		} 
	) // end forEach childStudent
	// Now toPush should have an array with the students that are in
	// both classes...
	if (toPush.length==0) {
		showAlert('No students found','There are no students in common between '+childRosterObj.className+' ('+childRosterObj.students.length+' students) and '+parentRosterObj.className+' ('+parentRosterObj.students.length+')');
		return false
	}
	else {
		if (confirmAction('Load student data?','Warning: loading student data will clear the current spreadsheet. Continue?')) {
			sheet = SpreadsheetApp.getActiveSheet();
			sheet.clear(); // Is this a good idea?
			sheet.appendRow([
				'First',
				'Last',
				'Email',
				'Child Folder ('+childRosterObj.className+')',
				'Parent Folder ('+parentRosterObj.className+')',
				'Exclude',
				'Completed',
			]);
			toPush.forEach(
				function (obj) {
					childStudent = obj[0];
					parentStudent = obj[1];
					if (childStudent.email==parentStudent.email) {
						// Just making sure -- this should be true anyway...
						sheet.appendRow([
							childStudent.firstName,
							childStudent.lastName,
							childStudent.email,
							childStudent.classFolder,
							parentStudent.classFolder,])
					}
					else {
						Logger.log('Odd -- child and parent not a match:'+JSON.stringify(childStudent)+' and '+JSON.stringify(parentStudent))
					}
				}) // end forEach child/parent
			// Set up formatting and such
			var excludeValidator = SpreadsheetApp.newDataValidation().requireValueInList(['Exclude',''],true);
			var lastRow = sheet.getDataRange().getLastRow()
			sheet.getRange(2,6,lastRow-1,1).setDataValidation(excludeValidator); // get exclude range...
			var header = sheet.getRange('A1:G1')
			header.setFontWeight('bold');
			header.setBackground('#000000');
			header.setFontColor('#ffffff');
			sheet.setFrozenRows(1);
			return true;
		} // end if confirmAction...
		return false;
	} // end if there are students to push...
} // end updateRostersOnSheet


/* Copy-pasted from Goobric goobricHome-code.gs */
function getHomeGlobal() {
  try {
    var global = {};
    Logger.log('getHomeGlobal')
    var rosters = DriveRoster.getRosters();
    Logger.log('got rosters')
		// We don't want classroom rosters since they don't have folders
    //var classRoomRosterNames = getClassroomRosterNames();    
    //Logger.log('classroom rosters...')
    //rosters = rosters.concat(classRoomRosterNames);
    rosters.sort(function(a, b) {
      var textA = a.className.toUpperCase();
      var textB = b.className.toUpperCase();
      return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    });
    global.rosters = rosters;
    global.userEmail = Session.getEffectiveUser().getEmail();
    Logger.log('Returning global: '+JSON.stringify(global)+':::')
    return global;
  } catch(err) {
    var errInfo = catchToString_(err);
    logErrInfo_(errInfo);
  }
}

function getClassroomRosterNames() {
  try {
    var crFolder = DriveApp.getFoldersByName('Classroom');
    var folder;
    var courseNames = [];
    var found = false;
    while (crFolder.hasNext()) {
      folder = crFolder.next();
      found = true;
    } 
    if (!found) {
      var crFolder2 = DriveApp.getFoldersByName('Google Classroom');
      while (crFolder2.hasNext()) {
        folder = crFolder2.next();
        found = true;
      }
    }
    if (folder) {
      var rosters = [];
      var classFolders = folder.getFolders();
      while (classFolders.hasNext()) {
        var thisRoster = {};
        thisRoster.className = "Google Classroom - " + classFolders.next().getName();
        rosters.push(thisRoster);
      }
      return rosters;
    } else {
      return [];
    }
  } catch(err) {
    var errInfo = catchToString_(err) 
    logErrInfo_(errInfo)
  }
}

function getPropopulationValues(doctopusId) {
  try {
    var prepopValues = {};
    var assignment = DriveRoster.getAssignmentByDoctopusId(doctopusId);
    prepopValues.className = assignment.rosters[0].className;
    prepopValues.assignments = getRosterAssignments(prepopValues.className);
    prepopValues.selectedIndex = -1;
    for (var i=0; i<prepopValues.assignments.length; i++) {
      if (prepopValues.assignments[i].name === assignment.name) {
        prepopValues.selectedIndex = i;
        break
      }
    }
    return prepopValues;
  } catch(err) {
    var errInfo = catchToString_(err) 
    logErrInfo_(errInfo)
  }
}


function getRosterAssignments(className) {
  try {
    var assignments = DriveRoster.getAssignments(className);
    return assignments;
  } catch(err) {
    var errInfo = catchToString_(err) 
    logErrInfo_(errInfo)
  }
}

function testGetRosterAssignments() {
  var assmts = getRosterAssignments("Large roster");
  var deets = getAssignmentDetails(assmts[0]);
  debugger;
}

function getAssignmentDetails(assignment, optIntervalId) {
  try {
    if (optIntervalId) {
      assignment.intervalId = optIntervalId;
    }
    var ssKey = assignment.ssKey;
    var rubricKey = assignment.rubricId ? assignment.rubricId : assignment.rubrics ? assignment.rubrics[0] : '';
    if (rubricKey) {
      try {
        var rubric = SpreadsheetApp.openById(rubricKey);
        assignment.rubricName = rubric.getName();
        assignment.rubricUrl = rubric.getUrl();
        assignment.hasRubric = true;
      } catch(err) {
        assignment.rubricName = "Rubric not accessible";
        assignment.rubricUrl = "#";
      }
    }
    var detailsArray = [];
    try {
      var ss = SpreadsheetApp.openById(ssKey);
      var sheetId = assignment.colMappings.sheetId;
      var sheet = getSheetById(ss, sheetId);
      if (assignment.hasRubric) {
        var rubricScoreSheet = ss.getSheetByName('rubricScores');
        var rubricScoreData = getRowsDataNonNormalized(rubricScoreSheet);
      }
      var data = getRowsDataNonNormalized(sheet);
      var mappings = new ColumnMappings(sheet.getSheetId());
      var timeZone = ss.getSpreadsheetTimeZone();
      for (var i=0; i<data.length; i++) {
        var theseScores = assignment.hasRubric ? getScores(data[i][mappings.fileKeyCol], rubricScoreData) : [];
        var theseDetails = {};
        theseDetails.firstName = data[i][mappings.firstNameCol];
        theseDetails.lastName = data[i][mappings.lastNameCol];
        theseDetails.fileName = data[i][mappings.fileNameCol];
        theseDetails.link = data[i][mappings.linkCol];
        theseDetails.goobricLink = webAppUrl + "?docId=" + data[i][mappings.fileKeyCol].split('||')[0] + "&webApp=true";
        theseDetails.count = data[i]['Count'];
        theseDetails.lastSubmitted = theseScores.length ? (Utilities.formatDate(theseScores[0]['Timestamp'], timeZone, "M/d/YYYY h:mm a") + " by " + theseScores[0]['Submitted by'].split("@")[0]) : '';
        detailsArray.push(theseDetails);
      }
      assignment.details = detailsArray;
      return assignment;
    } catch(err) {
      return assignment;
    }
  } catch(err) {
    var errInfo = catchToString_(err) 
    logErrInfo_(errInfo)
  }
}


function getScores(fileKey, scoreData) {
  try {
    var theseScores = [];
    for (var i=0; i<scoreData.length; i++) {
      if (scoreData[i]['File Key'] === fileKey) {
        theseScores.push(scoreData[i]);
      }
    }
    theseScores.sort(function(a, b) {
      return new Date(b['Timestamp']) - new Date(a['Timestamp']);
    })
    return theseScores;
  } catch(err) {
    var errInfo = catchToString_(err) 
    logErrInfo_(errInfo)
  }
}
