function catchToString_(err) {
  var errInfo = "Caught something:\n"; 
  for (var prop in err)  {  
    errInfo += "  property: "+ prop+ "\n    value: ["+ err[prop]+ "]\n"; 
  } 
  errInfo += "  toString(): " + " value: [" + err.toString() + "]"; 
  return errInfo;
}


function logErrInfo_(errInfo) {
  Logger.log(errInfo); return;
  var ss = SpreadsheetApp.openById('<your error logging spreadsheet here>');
  //Error logging spreadsheet needs headers: "Timestamp" and "Error Message"
  var sheet = ss.getSheets()[0];
  var date = new Date();
  var thisObj = {};
  thisObj.timestamp = date;
  thisObj.errorMessage = errInfo;
  NVSL.setRowsData(sheet, [thisObj], sheet.getRange(1, 1, 1, sheet.getLastColumn()), sheet.getLastRow()+1);
}
