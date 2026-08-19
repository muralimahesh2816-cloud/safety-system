Attribute VB_Name = "modEDVVerification"
Option Explicit

' =============================================================================
' EDV Image Verification Tool
' Production module for a strict two-phase workflow:
'   Phase 1 - find and copy server images to the local PC.
'   Phase 2 - create linked Excel previews from local files only.
'
' No external VBA references are required. FileSystemObject and Dictionary are
' created late-bound. Vehicle/image verification remains a manual decision.
' =============================================================================

Private Const EDV_CONFIG_SHEET As String = "EDV_Config"
Private Const EDV_REVIEW_SHEET As String = "EDV_Review"
Private Const EDV_PREVIEW_PREFIX As String = "EDV_PREVIEW_"
Private Const EDV_REVIEW_PREVIEW As String = "EDV_REVIEW_PREVIEW"

Private Const EDV_HEADER_ROW As Long = 1
Private Const EDV_FIRST_DATA_ROW As Long = 2

Private Const COL_TRANSACTION_ID As Long = 2       ' B
Private Const COL_LANE As Long = 3                 ' C
Private Const COL_SHIFT_DATE As Long = 4           ' D
Private Const COL_SOURCE As Long = 27              ' AA
Private Const COL_COPY_STATUS As Long = 28         ' AB
Private Const COL_PREVIEW As Long = 29             ' AC
Private Const COL_OPEN_LINK As Long = 30            ' AD
Private Const COL_LOCAL_PATH As Long = 31           ' AE
Private Const COL_SERVER_PATH As Long = 32          ' AF
Private Const COL_VERIFY_RESULT As Long = 33        ' AG
Private Const COL_MOL_REMARK As Long = 34           ' AH
Private Const COL_VERIFIED_BY As Long = 35          ' AI
Private Const COL_VERIFY_DATE As Long = 36          ' AJ
Private Const COL_LAST_UPDATED As Long = 37         ' AK

Private Const CFG_SERVER_ROOT_ROW As Long = 4
Private Const CFG_LOCAL_ROOT_ROW As Long = 5
Private Const CFG_INCLUDE_SUBFOLDERS_ROW As Long = 6
Private Const CFG_REFRESH_CHANGED_ROW As Long = 7
Private Const CFG_INTERVAL_ROW As Long = 8
Private Const CFG_AUTO_ENABLED_ROW As Long = 9
Private Const CFG_EXTENSIONS_ROW As Long = 10
Private Const CFG_DATA_SHEET_ROW As Long = 11
Private Const CFG_SOURCE_COLUMN_ROW As Long = 12
Private Const CFG_DATE_COLUMN_ROW As Long = 13
Private Const CFG_LAST_SIGNATURE_ROW As Long = 17
Private Const CFG_LAST_REFRESH_ROW As Long = 18
Private Const CFG_INDEX_STATE_ROW As Long = 19

Private Const DEFAULT_INTERVAL_SECONDS As Long = 60
Private Const MIN_INTERVAL_SECONDS As Long = 15
Private Const DEFAULT_EXTENSIONS As String = "JPG;JPEG;PNG;BMP;TIF;TIFF"

Private Type EDVProcessStats
    TotalRows As Long
    Copied As Long
    Updated As Long
    UpToDate As Long
    NotFound As Long
    CopyErrors As Long
    Previews As Long
End Type

Public gEDVAppEvents As CEDVApplicationEvents
Public gEDVLastSelectedRow As Long

Private gEDVImageIndex As Object
Private gEDVIndexSettingSignature As String
Private gEDVRequiredSignature As String
Private gEDVNextRun As Date
Private gEDVOnTimeProcedure As String
Private gEDVAutoScheduled As Boolean
Private gEDVIsProcessing As Boolean
Private gEDVClosing As Boolean

' Runs automatically when the workbook opens and macros are enabled.
Public Sub Auto_Open()
    On Error Resume Next
    gEDVClosing = False
    EDV_InitializeApplicationEvents
    If EDV_ConfigExists Then
        If EDV_IsYes(EDV_GetConfigValue(CFG_AUTO_ENABLED_ROW)) Then
            EDV_ScheduleNextRefresh
        End If
    End If
    On Error GoTo 0
End Sub

' Legacy Auto_Close plus the application event class provide redundant,
' safe cancellation of a pending Application.OnTime event.
Public Sub Auto_Close()
    On Error Resume Next
    gEDVClosing = True
    EDV_CancelScheduledRefresh
    Set gEDVAppEvents = Nothing
    On Error GoTo 0
End Sub

' Main one-time setup macro requested by the user.
Public Sub EDV_Setup()
    Dim dataWs As Worksheet
    Dim configWs As Worksheet
    Dim reviewWs As Worksheet
    Dim oldScreenUpdating As Boolean
    Dim oldEnableEvents As Boolean
    Dim oldCalculation As XlCalculation
    Dim errorNumber As Long
    Dim errorDescription As String

    On Error GoTo SetupError

    oldScreenUpdating = Application.ScreenUpdating
    oldEnableEvents = Application.EnableEvents
    oldCalculation = Application.Calculation

    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual

    Set dataWs = EDV_GetInitialDataSheet()
    If dataWs Is Nothing Then
        Err.Raise vbObjectError + 2100, "EDV_Setup", _
                  "No transaction data sheet is available."
    End If

    EDV_EnsureOutputHeaders dataWs
    Set configWs = EDV_CreateOrUpdateConfigSheet(dataWs.Name)
    Set reviewWs = EDV_CreateOrUpdateReviewSheet()
    EDV_InitializeApplicationEvents

    configWs.Activate
    configWs.Range("A1").Select

SetupExit:
    On Error Resume Next
    Application.ScreenUpdating = oldScreenUpdating
    Application.EnableEvents = oldEnableEvents
    Application.Calculation = oldCalculation
    On Error GoTo 0

    If errorNumber <> 0 Then
        MsgBox "EDV setup could not be completed." & vbCrLf & vbCrLf & _
               errorDescription, vbCritical, "EDV Image Verification"
    Else
        MsgBox "EDV Image Verification Tool setup is complete." & vbCrLf & vbCrLf & _
               "Data sheet: " & dataWs.Name & vbCrLf & _
               "Next: select the server folder, then run " & _
               "EDV_Copy_Then_Preview_All.", _
               vbInformation, "EDV Image Verification"
    End If
    Exit Sub

SetupError:
    errorNumber = Err.Number
    errorDescription = Err.Description
    Resume SetupExit
End Sub

' The main processing macro requested by the user.
Public Sub EDV_Copy_Then_Preview_All()
    EDV_ProcessAll False, False
End Sub

' Clears the cached server index and performs a complete reindex/update.
Public Sub EDV_Force_Reindex_Update()
    Set gEDVImageIndex = Nothing
    gEDVIndexSettingSignature = vbNullString
    gEDVRequiredSignature = vbNullString
    EDV_ProcessAll True, False
End Sub

Public Sub EDV_Select_Server_Folder()
    Dim selectedPath As String
    selectedPath = EDV_PickFolder("Select the server image root folder", _
                                  CStr(EDV_GetConfigValue(CFG_SERVER_ROOT_ROW)))
    If Len(selectedPath) > 0 Then
        EDV_SetConfigValue CFG_SERVER_ROOT_ROW, selectedPath
        Set gEDVImageIndex = Nothing
        gEDVIndexSettingSignature = vbNullString
        gEDVRequiredSignature = vbNullString
    End If
End Sub

Public Sub EDV_Select_Local_Output_Folder()
    Dim selectedPath As String
    selectedPath = EDV_PickFolder("Select the local EDV output folder", _
                                  CStr(EDV_GetConfigValue(CFG_LOCAL_ROOT_ROW)))
    If Len(selectedPath) > 0 Then
        EDV_SetConfigValue CFG_LOCAL_ROOT_ROW, selectedPath
    End If
End Sub

Public Sub EDV_Open_Local_Image_Folder()
    Dim folderPath As String
    Dim fso As Object

    On Error GoTo OpenError
    folderPath = Trim$(CStr(EDV_GetConfigValue(CFG_LOCAL_ROOT_ROW)))
    If Len(folderPath) = 0 Then folderPath = EDV_DefaultLocalFolder()

    Set fso = CreateObject("Scripting.FileSystemObject")
    EDV_EnsureFolderExists folderPath, fso
    Shell "explorer.exe " & Chr$(34) & folderPath & Chr$(34), vbNormalFocus
    Exit Sub

OpenError:
    MsgBox "The local image folder could not be opened." & vbCrLf & _
           Err.Description, vbExclamation, "EDV Image Verification"
End Sub

Public Sub EDV_Enable_Auto_Refresh()
    On Error GoTo EnableError
    EDV_InitializeApplicationEvents
    EDV_SetConfigValue CFG_AUTO_ENABLED_ROW, "YES"
    gEDVClosing = False
    EDV_CancelScheduledRefresh
    EDV_ScheduleNextRefresh
    MsgBox "Automatic refresh is enabled." & vbCrLf & _
           "The configured minimum interval is " & _
           EDV_GetRefreshIntervalSeconds() & " seconds.", _
           vbInformation, "EDV Image Verification"
    Exit Sub

EnableError:
    MsgBox "Automatic refresh could not be enabled." & vbCrLf & _
           Err.Description, vbExclamation, "EDV Image Verification"
End Sub

Public Sub EDV_Disable_Auto_Refresh()
    On Error Resume Next
    EDV_SetConfigValue CFG_AUTO_ENABLED_ROW, "NO"
    EDV_CancelScheduledRefresh
    On Error GoTo 0
    MsgBox "Automatic refresh is disabled.", _
           vbInformation, "EDV Image Verification"
End Sub

' Application.OnTime callback. It never opens a folder-selection dialog.
Public Sub EDV_AutoRefreshTick()
    Dim dataWs As Worksheet
    Dim dataSignature As String
    Dim lastSignature As String

    On Error GoTo ScheduleAgain
    gEDVAutoScheduled = False

    If gEDVClosing Then Exit Sub
    If Not EDV_ConfigExists Then Exit Sub
    If Not EDV_IsYes(EDV_GetConfigValue(CFG_AUTO_ENABLED_ROW)) Then Exit Sub
    If gEDVIsProcessing Then GoTo ScheduleAgain

    Set dataWs = EDV_GetConfiguredDataSheet(False)
    If dataWs Is Nothing Then GoTo ScheduleAgain

    dataSignature = EDV_CurrentDataSignature(dataWs)
    lastSignature = CStr(EDV_GetConfigValue(CFG_LAST_SIGNATURE_ROW))

    If dataSignature <> lastSignature Then
        EDV_ProcessAll False, True
    End If

ScheduleAgain:
    If Not gEDVClosing Then
        If EDV_ConfigExists Then
            If EDV_IsYes(EDV_GetConfigValue(CFG_AUTO_ENABLED_ROW)) Then
                EDV_ScheduleNextRefresh
            End If
        End If
    End If
End Sub

' Opens the review sheet for the selected transaction row.
Public Sub EDV_Review_Selected_Row()
    Dim dataWs As Worksheet
    Dim reviewWs As Worksheet
    Dim sourceRow As Long
    Dim localPath As String

    On Error GoTo ReviewError
    EDV_InitializeApplicationEvents
    Set dataWs = EDV_GetConfiguredDataSheet(True)
    If dataWs Is Nothing Then Exit Sub

    If ActiveSheet Is dataWs Then
        If ActiveCell.Row >= EDV_FIRST_DATA_ROW Then sourceRow = ActiveCell.Row
    End If
    If sourceRow = 0 Then sourceRow = gEDVLastSelectedRow

    If sourceRow < EDV_FIRST_DATA_ROW Or sourceRow > EDV_LastDataRow(dataWs) Then
        MsgBox "Select a transaction row on the data sheet first, then run " & _
               "REVIEW SELECTED ROW.", vbExclamation, "EDV Review"
        Exit Sub
    End If

    Set reviewWs = EDV_CreateOrUpdateReviewSheet()
    reviewWs.Range("J1").Value2 = dataWs.Name
    reviewWs.Range("J2").Value2 = sourceRow

    reviewWs.Range("B4").Value = dataWs.Cells(sourceRow, COL_TRANSACTION_ID).Value
    reviewWs.Range("B5").Value = dataWs.Cells(sourceRow, _
        EDV_FindHeaderColumn(dataWs, Array("Vehicle No", "Vehicle Number", _
        "VRN", "Normalized Vehicle No"), 7)).Value
    reviewWs.Range("B6").Value = dataWs.Cells(sourceRow, COL_LANE).Value
    reviewWs.Range("B7").Value = dataWs.Cells(sourceRow, COL_SHIFT_DATE).Value
    reviewWs.Range("B8").Value = dataWs.Cells(sourceRow, _
        EDV_FindHeaderColumn(dataWs, Array("Transaction Date", "Txn Date"), 6)).Value
    reviewWs.Range("B9").Value = dataWs.Cells(sourceRow, _
        EDV_FindHeaderColumn(dataWs, Array("TC MOP", "Toll Collector MOP"), 15)).Value
    reviewWs.Range("B10").Value = dataWs.Cells(sourceRow, _
        EDV_FindHeaderColumn(dataWs, Array("Validator MOP"), 16)).Value
    reviewWs.Range("B11").Value = dataWs.Cells(sourceRow, _
        EDV_FindHeaderColumn(dataWs, Array("Operator ID - Name", _
        "Operator Name", "Operator"), 17)).Value
    reviewWs.Range("B12").Value = dataWs.Cells(sourceRow, _
        EDV_FindHeaderColumn(dataWs, Array("Validator ID - Name", _
        "Validator Name", "Validator"), 18)).Value
    reviewWs.Range("B13").Value = dataWs.Cells(sourceRow, COL_COPY_STATUS).Value

    reviewWs.Range("B16").Value = dataWs.Cells(sourceRow, COL_VERIFY_RESULT).Value
    reviewWs.Range("B17").Value = dataWs.Cells(sourceRow, COL_MOL_REMARK).Value
    reviewWs.Range("B19").Value = dataWs.Cells(sourceRow, COL_VERIFIED_BY).Value
    reviewWs.Range("E19").Value = dataWs.Cells(sourceRow, COL_VERIFY_DATE).Value

    If Len(Trim$(CStr(reviewWs.Range("B19").Value))) = 0 Then
        reviewWs.Range("B19").Value = Environ$("USERNAME")
    End If

    reviewWs.Range("B7").NumberFormat = "yyyy-mm-dd"
    reviewWs.Range("B8").NumberFormat = "yyyy-mm-dd hh:mm:ss"
    reviewWs.Range("E19").NumberFormat = "yyyy-mm-dd hh:mm"

    localPath = Trim$(CStr(dataWs.Cells(sourceRow, COL_LOCAL_PATH).Value))
    EDV_PlaceReviewPreview reviewWs, localPath

    reviewWs.Activate
    reviewWs.Range("B16").Select
    Exit Sub

ReviewError:
    MsgBox "The selected transaction could not be opened for review." & vbCrLf & _
           Err.Description, vbCritical, "EDV Review"
End Sub

' Saves a manual review back to AG:AJ and updates AK.
Public Sub EDV_Save_Review()
    Dim reviewWs As Worksheet
    Dim dataWs As Worksheet
    Dim sourceRow As Long
    Dim resultText As String
    Dim remarkText As String
    Dim verifiedByText As String
    Dim verificationDate As Date
    Dim transactionId As String
    Dim vehicleNumber As String

    On Error GoTo SaveError
    Set reviewWs = ThisWorkbook.Worksheets(EDV_REVIEW_SHEET)
    Set dataWs = ThisWorkbook.Worksheets(CStr(reviewWs.Range("J1").Value2))
    sourceRow = CLng(Val(CStr(reviewWs.Range("J2").Value2)))

    If sourceRow < EDV_FIRST_DATA_ROW Then
        Err.Raise vbObjectError + 2101, "EDV_Save_Review", _
                  "No transaction row is loaded in the review sheet."
    End If

    resultText = UCase$(Trim$(CStr(reviewWs.Range("B16").Value)))
    If Not EDV_IsValidVerificationResult(resultText) Then
        MsgBox "Select a valid Verification Result before saving.", _
               vbExclamation, "EDV Review"
        Exit Sub
    End If

    transactionId = EDV_ValueToId(dataWs.Cells(sourceRow, COL_TRANSACTION_ID).Value2)
    vehicleNumber = Trim$(CStr(reviewWs.Range("B5").Value))
    remarkText = Trim$(CStr(reviewWs.Range("B17").Value))
    If Len(remarkText) = 0 Then
        remarkText = EDV_GenerateMOLRemark(resultText, transactionId, vehicleNumber)
    End If

    verifiedByText = Trim$(CStr(reviewWs.Range("B19").Value))
    If Len(verifiedByText) = 0 Then verifiedByText = Environ$("USERNAME")

    If IsDate(reviewWs.Range("E19").Value) Then
        verificationDate = CDate(reviewWs.Range("E19").Value)
    Else
        verificationDate = Now
    End If

    dataWs.Cells(sourceRow, COL_VERIFY_RESULT).Value = resultText
    dataWs.Cells(sourceRow, COL_MOL_REMARK).Value = remarkText
    dataWs.Cells(sourceRow, COL_VERIFIED_BY).Value = verifiedByText
    dataWs.Cells(sourceRow, COL_VERIFY_DATE).Value = verificationDate
    dataWs.Cells(sourceRow, COL_LAST_UPDATED).Value = Now
    dataWs.Cells(sourceRow, COL_VERIFY_DATE).NumberFormat = "yyyy-mm-dd hh:mm"
    dataWs.Cells(sourceRow, COL_LAST_UPDATED).NumberFormat = "yyyy-mm-dd hh:mm"

    reviewWs.Range("B17").Value = remarkText
    reviewWs.Range("B19").Value = verifiedByText
    reviewWs.Range("E19").Value = verificationDate
    reviewWs.Range("E19").NumberFormat = "yyyy-mm-dd hh:mm"

    MsgBox "The manual EDV verification was saved to row " & sourceRow & ".", _
           vbInformation, "EDV Review"
    Exit Sub

SaveError:
    MsgBox "The EDV verification could not be saved." & vbCrLf & _
           Err.Description, vbCritical, "EDV Review"
End Sub

Public Sub EDV_Open_Review_Image()
    Dim reviewWs As Worksheet
    Dim dataWs As Worksheet
    Dim sourceRow As Long
    Dim localPath As String
    Dim fso As Object

    On Error GoTo ImageError
    Set reviewWs = ThisWorkbook.Worksheets(EDV_REVIEW_SHEET)
    Set dataWs = ThisWorkbook.Worksheets(CStr(reviewWs.Range("J1").Value2))
    sourceRow = CLng(Val(CStr(reviewWs.Range("J2").Value2)))
    localPath = Trim$(CStr(dataWs.Cells(sourceRow, COL_LOCAL_PATH).Value))
    Set fso = CreateObject("Scripting.FileSystemObject")

    If Len(localPath) = 0 Or Not fso.FileExists(localPath) Then
        MsgBox "The local EDV image is not available.", _
               vbExclamation, "EDV Review"
        Exit Sub
    End If

    ThisWorkbook.FollowHyperlink Address:=localPath, NewWindow:=True
    Exit Sub

ImageError:
    MsgBox "The local EDV image could not be opened." & vbCrLf & _
           Err.Description, vbExclamation, "EDV Review"
End Sub

Public Sub EDV_Return_To_Data()
    Dim reviewWs As Worksheet
    Dim dataWs As Worksheet
    Dim sourceRow As Long

    On Error GoTo ReturnError
    Set reviewWs = ThisWorkbook.Worksheets(EDV_REVIEW_SHEET)
    Set dataWs = ThisWorkbook.Worksheets(CStr(reviewWs.Range("J1").Value2))
    sourceRow = CLng(Val(CStr(reviewWs.Range("J2").Value2)))
    dataWs.Activate
    dataWs.Cells(sourceRow, COL_TRANSACTION_ID).Select
    Exit Sub

ReturnError:
    MsgBox "The source transaction row is not available.", _
           vbExclamation, "EDV Review"
End Sub

' Initializes the application event listener. The companion class module is
' required and uses only native Excel events.
Public Sub EDV_InitializeApplicationEvents()
    On Error GoTo EventError
    If gEDVAppEvents Is Nothing Then
        Set gEDVAppEvents = New CEDVApplicationEvents
        Set gEDVAppEvents.App = Application
    End If
    Exit Sub

EventError:
    Set gEDVAppEvents = Nothing
End Sub

' Called by the event class before this workbook closes.
Public Sub EDV_Handle_Workbook_Before_Close(ByVal Wb As Workbook)
    On Error Resume Next
    If Wb Is ThisWorkbook Then
        gEDVClosing = True
        EDV_CancelScheduledRefresh
    End If
    On Error GoTo 0
End Sub

' Called by the event class so the Config-sheet review button can remember the
' last selected transaction row.
Public Sub EDV_Record_Selected_Row(ByVal Sh As Object, ByVal Target As Range)
    Dim dataWs As Worksheet

    On Error GoTo RecordExit
    Set dataWs = EDV_GetConfiguredDataSheet(False)
    If dataWs Is Nothing Then GoTo RecordExit
    If Sh Is dataWs Then
        If Target.Row >= EDV_FIRST_DATA_ROW Then
            gEDVLastSelectedRow = Target.Row
        End If
    End If

RecordExit:
End Sub

' =============================================================================
' Core processing
' =============================================================================

Private Sub EDV_ProcessAll(ByVal forceReindex As Boolean, _
                           ByVal isAutomatic As Boolean)
    Dim dataWs As Worksheet
    Dim configWs As Worksheet
    Dim fso As Object
    Dim extensions As Object
    Dim requiredKeys As Object
    Dim directPaths As Object
    Dim imageIndex As Object
    Dim dataValues As Variant
    Dim lastRow As Long
    Dim serverRoot As String
    Dim localRoot As String
    Dim includeSubfolders As Boolean
    Dim refreshChanged As Boolean
    Dim requiredSignature As String
    Dim settingSignature As String
    Dim dataSignature As String
    Dim stats As EDVProcessStats
    Dim startedAt As Double
    Dim elapsedSeconds As Double
    Dim oldScreenUpdating As Boolean
    Dim oldEnableEvents As Boolean
    Dim oldDisplayStatusBar As Boolean
    Dim oldCalculation As XlCalculation
    Dim oldStatusBar As Variant
    Dim settingsCaptured As Boolean
    Dim errorNumber As Long
    Dim errorDescription As String

    If gEDVIsProcessing Then Exit Sub
    gEDVIsProcessing = True
    startedAt = Timer

    On Error GoTo ProcessError

    oldScreenUpdating = Application.ScreenUpdating
    oldEnableEvents = Application.EnableEvents
    oldCalculation = Application.Calculation
    oldDisplayStatusBar = Application.DisplayStatusBar
    oldStatusBar = Application.StatusBar
    settingsCaptured = True

    If Not EDV_ConfigExists Then
        If isAutomatic Then GoTo ProcessExit
        EDV_Setup
        If Not EDV_ConfigExists Then GoTo ProcessExit
    End If

    Set configWs = ThisWorkbook.Worksheets(EDV_CONFIG_SHEET)
    Set dataWs = EDV_GetConfiguredDataSheet(Not isAutomatic)
    If dataWs Is Nothing Then GoTo ProcessExit

    Set fso = CreateObject("Scripting.FileSystemObject")
    serverRoot = EDV_TrimTrailingSlash(Trim$(CStr( _
                 EDV_GetConfigValue(CFG_SERVER_ROOT_ROW))))
    localRoot = EDV_TrimTrailingSlash(Trim$(CStr( _
                EDV_GetConfigValue(CFG_LOCAL_ROOT_ROW))))

    If Len(localRoot) = 0 Then
        localRoot = EDV_DefaultLocalFolder()
        EDV_SetConfigValue CFG_LOCAL_ROOT_ROW, localRoot
    End If

    If Len(serverRoot) = 0 Or Not fso.FolderExists(serverRoot) Then
        If isAutomatic Then
            Err.Raise vbObjectError + 2102, "EDV_ProcessAll", _
                      "The configured server image root folder is unavailable."
        End If
        EDV_Select_Server_Folder
        serverRoot = EDV_TrimTrailingSlash(Trim$(CStr( _
                     EDV_GetConfigValue(CFG_SERVER_ROOT_ROW))))
        If Len(serverRoot) = 0 Or Not fso.FolderExists(serverRoot) Then
            MsgBox "Select an accessible server image root folder before processing.", _
                   vbExclamation, "EDV Image Verification"
            GoTo ProcessExit
        End If
    End If

    EDV_EnsureFolderExists localRoot, fso
    includeSubfolders = EDV_IsYes(EDV_GetConfigValue(CFG_INCLUDE_SUBFOLDERS_ROW))
    refreshChanged = EDV_IsYes(EDV_GetConfigValue(CFG_REFRESH_CHANGED_ROW))
    Set extensions = EDV_BuildExtensionDictionary( _
                     CStr(EDV_GetConfigValue(CFG_EXTENSIONS_ROW)))

    lastRow = EDV_LastDataRow(dataWs)
    If lastRow < EDV_FIRST_DATA_ROW Then
        If Not isAutomatic Then
            MsgBox "No transaction rows were found on " & dataWs.Name & ".", _
                   vbInformation, "EDV Image Verification"
        End If
        GoTo ProcessExit
    End If

    dataValues = dataWs.Range(dataWs.Cells(EDV_FIRST_DATA_ROW, 1), _
                                  dataWs.Cells(lastRow, COL_SOURCE)).Value2
    dataSignature = EDV_ComputeDataSignature(dataValues)
    Set requiredKeys = CreateObject("Scripting.Dictionary")
    requiredKeys.CompareMode = vbTextCompare
    Set directPaths = CreateObject("Scripting.Dictionary")
    directPaths.CompareMode = vbTextCompare
    EDV_BuildRequiredKeys dataValues, serverRoot, extensions, fso, _
                          requiredKeys, directPaths

    requiredSignature = EDV_ComputeRequiredSignature(requiredKeys)
    settingSignature = LCase$(serverRoot) & "|" & _
                       CStr(includeSubfolders) & "|" & _
                       EDV_NormalizedExtensionList(extensions)

    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual
    Application.DisplayStatusBar = True
    Application.StatusBar = "EDV Phase 1 of 2: indexing server images..."

    If EDV_ShouldRebuildIndex(forceReindex, isAutomatic, refreshChanged, _
                              settingSignature, requiredSignature) Then
        Set imageIndex = EDV_BuildImageIndex(serverRoot, includeSubfolders, _
                                             requiredKeys, extensions, fso)
        Set gEDVImageIndex = imageIndex
        gEDVIndexSettingSignature = settingSignature
        gEDVRequiredSignature = requiredSignature
    Else
        Set imageIndex = gEDVImageIndex
    End If

    configWs.Cells(CFG_INDEX_STATE_ROW, 2).Value = _
        "Ready - " & Format$(Now, "yyyy-mm-dd hh:nn:ss") & _
        " (" & Format$(imageIndex.Count, "#,##0") & " keys)"

    Application.StatusBar = "EDV Phase 1 of 2: copying images to the local PC..."
    EDV_RunCopyPhase dataWs, dataValues, lastRow, serverRoot, localRoot, _
                     refreshChanged, imageIndex, directPaths, extensions, fso, stats

    Application.StatusBar = "EDV Phase 2 of 2: creating linked local previews..."
    EDV_RunPreviewPhase dataWs, lastRow, fso, stats

    EDV_SetConfigValue CFG_LAST_SIGNATURE_ROW, dataSignature
    EDV_SetConfigValue CFG_LAST_REFRESH_ROW, Now
    configWs.Cells(CFG_LAST_REFRESH_ROW, 2).NumberFormat = "yyyy-mm-dd hh:mm:ss"

ProcessExit:
    On Error Resume Next
    If settingsCaptured Then
        Application.Calculation = oldCalculation
        Application.ScreenUpdating = oldScreenUpdating
        Application.EnableEvents = oldEnableEvents
        Application.DisplayStatusBar = oldDisplayStatusBar
        Application.StatusBar = oldStatusBar
    End If
    On Error GoTo 0

    elapsedSeconds = Timer - startedAt
    If elapsedSeconds < 0 Then elapsedSeconds = elapsedSeconds + 86400#
    gEDVIsProcessing = False

    If errorNumber <> 0 Then
        If Not isAutomatic Then
            MsgBox "EDV processing stopped safely." & vbCrLf & vbCrLf & _
                   errorDescription, vbCritical, "EDV Image Verification"
        End If
    ElseIf Not isAutomatic And stats.TotalRows > 0 Then
        MsgBox EDV_CompletionMessage(stats, elapsedSeconds), _
               vbInformation, "EDV Image Verification - Complete"
    End If
    Exit Sub

ProcessError:
    errorNumber = Err.Number
    errorDescription = Err.Description
    Resume ProcessExit
End Sub

Private Sub EDV_RunCopyPhase(ByVal dataWs As Worksheet, _
                             ByVal dataValues As Variant, _
                             ByVal lastRow As Long, _
                             ByVal serverRoot As String, _
                             ByVal localRoot As String, _
                             ByVal refreshChanged As Boolean, _
                             ByVal imageIndex As Object, _
                             ByVal directPaths As Object, _
                             ByVal extensions As Object, _
                             ByVal fso As Object, _
                             ByRef stats As EDVProcessStats)
    Dim rowCount As Long
    Dim i As Long
    Dim worksheetRow As Long
    Dim transactionId As String
    Dim laneText As String
    Dim sourceText As String
    Dim matchedPath As String
    Dim localPath As String
    Dim statusText As String
    Dim dateFolder As String
    Dim laneFolder As String
    Dim outputFolder As String
    Dim statusValues() As Variant
    Dim localValues() As Variant
    Dim serverValues() As Variant
    Dim updatedValues() As Variant
    Dim nowValue As Date

    rowCount = lastRow - EDV_FIRST_DATA_ROW + 1
    ReDim statusValues(1 To rowCount, 1 To 1)
    ReDim localValues(1 To rowCount, 1 To 1)
    ReDim serverValues(1 To rowCount, 1 To 1)
    ReDim updatedValues(1 To rowCount, 1 To 1)

    EDV_LoadExistingColumnValues dataWs, EDV_FIRST_DATA_ROW, lastRow, _
                                 COL_COPY_STATUS, statusValues
    EDV_LoadExistingColumnValues dataWs, EDV_FIRST_DATA_ROW, lastRow, _
                                 COL_LOCAL_PATH, localValues
    EDV_LoadExistingColumnValues dataWs, EDV_FIRST_DATA_ROW, lastRow, _
                                 COL_SERVER_PATH, serverValues
    EDV_LoadExistingColumnValues dataWs, EDV_FIRST_DATA_ROW, lastRow, _
                                 COL_LAST_UPDATED, updatedValues

    nowValue = Now
    For i = 1 To rowCount
        worksheetRow = EDV_FIRST_DATA_ROW + i - 1
        transactionId = EDV_ValueToId(dataValues(i, COL_TRANSACTION_ID))
        laneText = EDV_SafeText(dataValues(i, COL_LANE))
        sourceText = EDV_SafeText(dataValues(i, COL_SOURCE))

        If Len(transactionId) > 0 Or Len(sourceText) > 0 Or _
           Len(laneText) > 0 Or Len(EDV_SafeText(dataValues(i, COL_SHIFT_DATE))) > 0 Then
            stats.TotalRows = stats.TotalRows + 1
            matchedPath = vbNullString
            localPath = vbNullString
            statusText = vbNullString

            If Len(sourceText) = 0 Then
                statusText = "SOURCE MISSING"
                stats.NotFound = stats.NotFound + 1
            Else
                matchedPath = EDV_ResolveServerImage(i, sourceText, _
                              transactionId, serverRoot, directPaths, _
                              imageIndex, extensions, fso)

                If Len(matchedPath) = 0 Then
                    statusText = "NOT FOUND"
                    stats.NotFound = stats.NotFound + 1
                Else
                    dateFolder = EDV_DateFolderName(dataValues(i, COL_SHIFT_DATE))
                    laneFolder = EDV_SanitizeFolderName(laneText, "Unknown-Lane")
                    outputFolder = EDV_CombinePath( _
                                   EDV_CombinePath(localRoot, dateFolder), laneFolder)

                    EDV_CopyOneImage matchedPath, outputFolder, refreshChanged, _
                                     fso, localPath, statusText

                    Select Case statusText
                        Case "COPIED"
                            stats.Copied = stats.Copied + 1
                        Case "UPDATED"
                            stats.Updated = stats.Updated + 1
                        Case "UP-TO-DATE"
                            stats.UpToDate = stats.UpToDate + 1
                        Case Else
                            stats.CopyErrors = stats.CopyErrors + 1
                            statusText = "COPY ERROR"
                            localPath = vbNullString
                    End Select
                End If
            End If

            statusValues(i, 1) = statusText
            localValues(i, 1) = localPath
            serverValues(i, 1) = matchedPath
            updatedValues(i, 1) = nowValue
        End If

        If i Mod 100 = 0 Then
            Application.StatusBar = "EDV Phase 1 of 2: copied/checked " & _
                                    Format$(i, "#,##0") & " of " & _
                                    Format$(rowCount, "#,##0") & " rows..."
            DoEvents
        End If
    Next i

    dataWs.Range(dataWs.Cells(EDV_FIRST_DATA_ROW, COL_COPY_STATUS), _
                 dataWs.Cells(lastRow, COL_COPY_STATUS)).Value = statusValues
    dataWs.Range(dataWs.Cells(EDV_FIRST_DATA_ROW, COL_LOCAL_PATH), _
                 dataWs.Cells(lastRow, COL_LOCAL_PATH)).Value = localValues
    dataWs.Range(dataWs.Cells(EDV_FIRST_DATA_ROW, COL_SERVER_PATH), _
                 dataWs.Cells(lastRow, COL_SERVER_PATH)).Value = serverValues
    dataWs.Range(dataWs.Cells(EDV_FIRST_DATA_ROW, COL_LAST_UPDATED), _
                 dataWs.Cells(lastRow, COL_LAST_UPDATED)).Value = updatedValues
    dataWs.Range(dataWs.Cells(EDV_FIRST_DATA_ROW, COL_LAST_UPDATED), _
                 dataWs.Cells(lastRow, COL_LAST_UPDATED)).NumberFormat = _
                 "yyyy-mm-dd hh:mm:ss"
End Sub

Private Sub EDV_RunPreviewPhase(ByVal dataWs As Worksheet, _
                                ByVal lastRow As Long, _
                                ByVal fso As Object, _
                                ByRef stats As EDVProcessStats)
    Dim rowCount As Long
    Dim localPaths As Variant
    Dim i As Long
    Dim worksheetRow As Long
    Dim localPath As String
    Dim previewCell As Range
    Dim linkCell As Range
    Dim pictureShape As Shape
    Dim maxWidth As Double
    Dim maxHeight As Double
    Dim scaleFactor As Double

    EDV_DeletePreviewShapes dataWs
    rowCount = lastRow - EDV_FIRST_DATA_ROW + 1
    localPaths = EDV_ReadSingleColumn(dataWs, EDV_FIRST_DATA_ROW, lastRow, _
                                      COL_LOCAL_PATH)

    dataWs.Columns(COL_PREVIEW).ColumnWidth = 28
    dataWs.Range(dataWs.Cells(EDV_FIRST_DATA_ROW, COL_OPEN_LINK), _
                 dataWs.Cells(lastRow, COL_OPEN_LINK)).Hyperlinks.Delete

    For i = 1 To rowCount
        worksheetRow = EDV_FIRST_DATA_ROW + i - 1
        localPath = Trim$(CStr(localPaths(i, 1)))
        Set previewCell = dataWs.Cells(worksheetRow, COL_PREVIEW)
        Set linkCell = dataWs.Cells(worksheetRow, COL_OPEN_LINK)

        previewCell.ClearContents
        linkCell.ClearContents

        If Len(localPath) > 0 And fso.FileExists(localPath) Then
            dataWs.Rows(worksheetRow).RowHeight = 88

            On Error Resume Next
            Set pictureShape = dataWs.Shapes.AddPicture( _
                Filename:=localPath, LinkToFile:=True, SaveWithDocument:=False, _
                Left:=previewCell.Left + 3, Top:=previewCell.Top + 3, _
                Width:=-1, Height:=-1)
            On Error GoTo 0

            If Not pictureShape Is Nothing Then
                pictureShape.Name = EDV_PREVIEW_PREFIX & CStr(worksheetRow)
                pictureShape.LockAspectRatio = -1
                maxWidth = previewCell.Width - 6
                maxHeight = previewCell.Height - 6
                scaleFactor = 1#

                If pictureShape.Width > maxWidth Then
                    scaleFactor = maxWidth / pictureShape.Width
                End If
                If pictureShape.Height * scaleFactor > maxHeight Then
                    scaleFactor = maxHeight / pictureShape.Height
                End If
                If scaleFactor < 1# Then pictureShape.Width = pictureShape.Width * scaleFactor

                pictureShape.Left = previewCell.Left + _
                                    (previewCell.Width - pictureShape.Width) / 2
                pictureShape.Top = previewCell.Top + _
                                   (previewCell.Height - pictureShape.Height) / 2
                pictureShape.Placement = xlMoveAndSize
                stats.Previews = stats.Previews + 1
            Else
                previewCell.Value = "Not Available"
                previewCell.HorizontalAlignment = xlCenter
                previewCell.VerticalAlignment = xlCenter
            End If

            dataWs.Hyperlinks.Add Anchor:=linkCell, Address:=localPath, _
                                  TextToDisplay:="Open Image"
            linkCell.HorizontalAlignment = xlCenter
        Else
            previewCell.Value = "Not Available"
            previewCell.HorizontalAlignment = xlCenter
            previewCell.VerticalAlignment = xlCenter
            linkCell.Value = "Not Available"
            linkCell.HorizontalAlignment = xlCenter
        End If

        Set pictureShape = Nothing
        If i Mod 100 = 0 Then
            Application.StatusBar = "EDV Phase 2 of 2: created " & _
                                    Format$(i, "#,##0") & " of " & _
                                    Format$(rowCount, "#,##0") & " previews..."
            DoEvents
        End If
    Next i
End Sub

Private Sub EDV_CopyOneImage(ByVal serverPath As String, _
                             ByVal outputFolder As String, _
                             ByVal refreshChanged As Boolean, _
                             ByVal fso As Object, _
                             ByRef localPath As String, _
                             ByRef statusText As String)
    Dim serverFile As Object
    Dim localFile As Object
    Dim sameSize As Boolean
    Dim sameTime As Boolean

    On Error GoTo CopyError
    EDV_EnsureFolderExists outputFolder, fso
    Set serverFile = fso.GetFile(serverPath)
    localPath = EDV_CombinePath(outputFolder, serverFile.Name)

    If fso.FileExists(localPath) Then
        Set localFile = fso.GetFile(localPath)
        sameSize = (CDbl(localFile.Size) = CDbl(serverFile.Size))
        sameTime = (Abs(DateDiff("s", localFile.DateLastModified, _
                                serverFile.DateLastModified)) <= 2)

        If (sameSize And sameTime) Or Not refreshChanged Then
            statusText = "UP-TO-DATE"
            Exit Sub
        End If

        fso.CopyFile serverPath, localPath, True
        If Not fso.FileExists(localPath) Then GoTo CopyError
        If CDbl(fso.GetFile(localPath).Size) <> CDbl(serverFile.Size) Then GoTo CopyError
        statusText = "UPDATED"
    Else
        fso.CopyFile serverPath, localPath, False
        If Not fso.FileExists(localPath) Then GoTo CopyError
        If CDbl(fso.GetFile(localPath).Size) <> CDbl(serverFile.Size) Then GoTo CopyError
        statusText = "COPIED"
    End If
    Exit Sub

CopyError:
    statusText = "COPY ERROR"
    localPath = vbNullString
    Err.Clear
End Sub

' =============================================================================
' Server index and matching
' =============================================================================

Private Function EDV_BuildImageIndex(ByVal serverRoot As String, _
                                     ByVal includeSubfolders As Boolean, _
                                     ByVal requiredKeys As Object, _
                                     ByVal extensions As Object, _
                                     ByVal fso As Object) As Object
    Dim imageIndex As Object
    Dim folders As Collection
    Dim folderPath As String
    Dim folderObject As Object
    Dim fileObject As Object
    Dim subfolderObject As Object

    Set imageIndex = CreateObject("Scripting.Dictionary")
    imageIndex.CompareMode = vbTextCompare

    ' All sources were resolved as valid complete paths; no server walk is needed.
    If requiredKeys.Count = 0 Then
        Set EDV_BuildImageIndex = imageIndex
        Exit Function
    End If

    If Not fso.FolderExists(serverRoot) Then
        Err.Raise vbObjectError + 2103, "EDV_BuildImageIndex", _
                  "The server image root folder cannot be accessed."
    End If

    Set folders = New Collection
    folders.Add serverRoot

    Do While folders.Count > 0
        folderPath = CStr(folders(folders.Count))
        folders.Remove folders.Count
        Set folderObject = Nothing

        On Error Resume Next
        Set folderObject = fso.GetFolder(folderPath)
        On Error GoTo 0

        If Not folderObject Is Nothing Then
            On Error Resume Next
            For Each fileObject In folderObject.Files
                EDV_IndexFileIfRequired fileObject, requiredKeys, extensions, imageIndex
            Next fileObject
            On Error GoTo 0

            If includeSubfolders Then
                On Error Resume Next
                For Each subfolderObject In folderObject.SubFolders
                    folders.Add subfolderObject.Path
                Next subfolderObject
                On Error GoTo 0
            End If
        End If
    Loop

    ' A full fresh scan is intentionally completed so duplicate filenames can be
    ' resolved to the latest modified file. Automatic refresh reuses this index
    ' and therefore exits before scanning when all required keys are unchanged.
    Set EDV_BuildImageIndex = imageIndex
End Function

Private Sub EDV_IndexFileIfRequired(ByVal fileObject As Object, _
                                    ByVal requiredKeys As Object, _
                                    ByVal extensions As Object, _
                                    ByVal imageIndex As Object)
    Dim extensionText As String
    Dim fullKey As String
    Dim baseKey As String
    Dim dotPosition As Long
    Dim fileName As String

    On Error GoTo IndexExit
    fileName = CStr(fileObject.Name)
    dotPosition = InStrRev(fileName, ".")
    If dotPosition <= 1 Or dotPosition = Len(fileName) Then GoTo IndexExit
    extensionText = LCase$(Mid$(fileName, dotPosition + 1))
    If Not extensions.Exists(extensionText) Then GoTo IndexExit

    fullKey = EDV_NormalizeKey(fileName)
    baseKey = EDV_NormalizeKey(Left$(fileName, dotPosition - 1))

    If requiredKeys.Exists(fullKey) Then
        EDV_KeepLatestIndexMatch fullKey, fileObject, imageIndex
    End If
    If requiredKeys.Exists(baseKey) Then
        EDV_KeepLatestIndexMatch baseKey, fileObject, imageIndex
    End If

IndexExit:
    Err.Clear
End Sub

Private Sub EDV_KeepLatestIndexMatch(ByVal keyText As String, _
                                     ByVal fileObject As Object, _
                                     ByVal imageIndex As Object)
    Dim candidate As Variant
    Dim existing As Variant
    Dim candidateDate As Double
    Dim existingDate As Double

    On Error GoTo KeepExit
    candidateDate = CDbl(fileObject.DateLastModified)
    candidate = Array(CStr(fileObject.Path), candidateDate, CDbl(fileObject.Size))

    If Not imageIndex.Exists(keyText) Then
        imageIndex.Add keyText, candidate
    Else
        existing = imageIndex(keyText)
        existingDate = CDbl(existing(1))
        If candidateDate > existingDate Then
            imageIndex(keyText) = candidate
        ElseIf candidateDate = existingDate Then
            If StrComp(CStr(fileObject.Path), CStr(existing(0)), _
                       vbTextCompare) > 0 Then
                imageIndex(keyText) = candidate
            End If
        End If
    End If

KeepExit:
    Err.Clear
End Sub

Private Sub EDV_BuildRequiredKeys(ByVal dataValues As Variant, _
                                  ByVal serverRoot As String, _
                                  ByVal extensions As Object, _
                                  ByVal fso As Object, _
                                  ByVal requiredKeys As Object, _
                                  ByVal directPaths As Object)
    Dim i As Long
    Dim sourceText As String
    Dim transactionId As String
    Dim directPath As String
    Dim candidates As Collection
    Dim candidate As Variant

    For i = 1 To UBound(dataValues, 1)
        sourceText = EDV_SafeText(dataValues(i, COL_SOURCE))
        If Len(sourceText) > 0 Then
            transactionId = EDV_ValueToId(dataValues(i, COL_TRANSACTION_ID))
            directPath = EDV_ValidDirectSourcePath(sourceText, serverRoot, _
                                                   extensions, fso)
            If Len(directPath) > 0 Then
                directPaths(CStr(i)) = directPath
            Else
                Set candidates = EDV_CandidateKeys(sourceText, transactionId, fso)
                For Each candidate In candidates
                    If Len(CStr(candidate)) > 0 Then
                        If Not requiredKeys.Exists(CStr(candidate)) Then
                            requiredKeys.Add CStr(candidate), True
                        End If
                    End If
                Next candidate
            End If
        End If
    Next i
End Sub

Private Function EDV_ResolveServerImage(ByVal dataIndex As Long, _
                                        ByVal sourceText As String, _
                                        ByVal transactionId As String, _
                                        ByVal serverRoot As String, _
                                        ByVal directPaths As Object, _
                                        ByVal imageIndex As Object, _
                                        ByVal extensions As Object, _
                                        ByVal fso As Object) As String
    Dim candidates As Collection
    Dim candidate As Variant
    Dim indexValue As Variant
    Dim directPath As String

    If directPaths.Exists(CStr(dataIndex)) Then
        directPath = CStr(directPaths(CStr(dataIndex)))
        If fso.FileExists(directPath) Then
            EDV_ResolveServerImage = directPath
            Exit Function
        End If
    End If

    Set candidates = EDV_CandidateKeys(sourceText, transactionId, fso)
    For Each candidate In candidates
        If imageIndex.Exists(CStr(candidate)) Then
            indexValue = imageIndex(CStr(candidate))
            If fso.FileExists(CStr(indexValue(0))) Then
                EDV_ResolveServerImage = CStr(indexValue(0))
                Exit Function
            End If
        End If
    Next candidate
End Function

Private Function EDV_CandidateKeys(ByVal sourceText As String, _
                                   ByVal transactionId As String, _
                                   ByVal fso As Object) As Collection
    Dim results As Collection
    Dim seen As Object
    Dim sourceName As String
    Dim sourceBase As String
    Dim sourceExtension As String

    Set results = New Collection
    Set seen = CreateObject("Scripting.Dictionary")
    seen.CompareMode = vbTextCompare

    sourceName = sourceText
    On Error Resume Next
    sourceName = fso.GetFileName(sourceText)
    On Error GoTo 0
    sourceName = Trim$(sourceName)

    If Len(sourceName) > 0 Then
        sourceExtension = LCase$(fso.GetExtensionName(sourceName))
        If Len(sourceExtension) > 0 Then
            EDV_AddCandidateKey results, seen, EDV_NormalizeKey(sourceName)
            sourceBase = fso.GetBaseName(sourceName)
        Else
            sourceBase = sourceName
        End If
        EDV_AddCandidateKey results, seen, EDV_NormalizeKey(sourceBase)
    End If

    If Len(transactionId) > 0 Then
        EDV_AddCandidateKey results, seen, EDV_NormalizeKey(transactionId & "_E")
        EDV_AddCandidateKey results, seen, EDV_NormalizeKey(transactionId & "_EDV")
        EDV_AddCandidateKey results, seen, EDV_NormalizeKey(transactionId)
    End If

    Set EDV_CandidateKeys = results
End Function

Private Sub EDV_AddCandidateKey(ByVal results As Collection, _
                                ByVal seen As Object, _
                                ByVal keyText As String)
    If Len(keyText) = 0 Then Exit Sub
    If Not seen.Exists(keyText) Then
        seen.Add keyText, True
        results.Add keyText
    End If
End Sub

Private Function EDV_ValidDirectSourcePath(ByVal sourceText As String, _
                                           ByVal serverRoot As String, _
                                           ByVal extensions As Object, _
                                           ByVal fso As Object) As String
    Dim extensionText As String

    On Error GoTo DirectExit
    If Not EDV_LooksLikeFullPath(sourceText) Then Exit Function
    If Not fso.FileExists(sourceText) Then Exit Function
    If Not EDV_PathIsWithinRoot(sourceText, serverRoot, fso) Then Exit Function

    extensionText = LCase$(fso.GetExtensionName(sourceText))
    If Not extensions.Exists(extensionText) Then Exit Function
    EDV_ValidDirectSourcePath = fso.GetAbsolutePathName(sourceText)

DirectExit:
    Err.Clear
End Function

Private Function EDV_ShouldRebuildIndex(ByVal forceReindex As Boolean, _
                                        ByVal isAutomatic As Boolean, _
                                        ByVal refreshChanged As Boolean, _
                                        ByVal settingSignature As String, _
                                        ByVal requiredSignature As String) As Boolean
    If forceReindex Then
        EDV_ShouldRebuildIndex = True
    ElseIf gEDVImageIndex Is Nothing Then
        EDV_ShouldRebuildIndex = True
    ElseIf gEDVIndexSettingSignature <> settingSignature Then
        EDV_ShouldRebuildIndex = True
    ElseIf gEDVRequiredSignature <> requiredSignature Then
        EDV_ShouldRebuildIndex = True
    ElseIf refreshChanged And Not isAutomatic Then
        EDV_ShouldRebuildIndex = True
    End If
End Function

' =============================================================================
' Configuration and professional sheet setup
' =============================================================================

Private Function EDV_CreateOrUpdateConfigSheet(ByVal dataSheetName As String) As Worksheet
    Dim ws As Worksheet
    Dim createdNew As Boolean
    Dim listSeparator As String

    Set ws = EDV_GetWorksheetIfExists(EDV_CONFIG_SHEET)
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add( _
                 After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ws.Name = EDV_CONFIG_SHEET
        createdNew = True
    End If

    On Error Resume Next
    ws.Range("A1:I2").UnMerge
    On Error GoTo 0
    ws.Range("A1:I2").Merge
    ws.Range("A1").Value = "EDV IMAGE VERIFICATION TOOL - CONFIGURATION"

    ws.Cells(CFG_SERVER_ROOT_ROW, 1).Value = "Server Image Root Folder"
    ws.Cells(CFG_LOCAL_ROOT_ROW, 1).Value = "Local Output Folder"
    ws.Cells(CFG_INCLUDE_SUBFOLDERS_ROW, 1).Value = "Include Subfolders: YES/NO"
    ws.Cells(CFG_REFRESH_CHANGED_ROW, 1).Value = "Refresh Changed Images: YES/NO"
    ws.Cells(CFG_INTERVAL_ROW, 1).Value = "Auto-Refresh Interval (seconds)"
    ws.Cells(CFG_AUTO_ENABLED_ROW, 1).Value = "Auto-Refresh Enabled: YES/NO"
    ws.Cells(CFG_EXTENSIONS_ROW, 1).Value = "Supported Image Extensions"
    ws.Cells(CFG_DATA_SHEET_ROW, 1).Value = "Data Sheet Name"
    ws.Cells(CFG_SOURCE_COLUMN_ROW, 1).Value = "Fixed Source Column"
    ws.Cells(CFG_DATE_COLUMN_ROW, 1).Value = "Fixed Date Column"

    If Len(Trim$(CStr(ws.Cells(CFG_LOCAL_ROOT_ROW, 2).Value))) = 0 Then
        ws.Cells(CFG_LOCAL_ROOT_ROW, 2).Value = EDV_DefaultLocalFolder()
    End If
    If Len(Trim$(CStr(ws.Cells(CFG_INCLUDE_SUBFOLDERS_ROW, 2).Value))) = 0 Then
        ws.Cells(CFG_INCLUDE_SUBFOLDERS_ROW, 2).Value = "YES"
    End If
    If Len(Trim$(CStr(ws.Cells(CFG_REFRESH_CHANGED_ROW, 2).Value))) = 0 Then
        ws.Cells(CFG_REFRESH_CHANGED_ROW, 2).Value = "YES"
    End If
    If Val(CStr(ws.Cells(CFG_INTERVAL_ROW, 2).Value)) < MIN_INTERVAL_SECONDS Then
        ws.Cells(CFG_INTERVAL_ROW, 2).Value = DEFAULT_INTERVAL_SECONDS
    End If
    If Len(Trim$(CStr(ws.Cells(CFG_AUTO_ENABLED_ROW, 2).Value))) = 0 Then
        ws.Cells(CFG_AUTO_ENABLED_ROW, 2).Value = "NO"
    End If
    If Len(Trim$(CStr(ws.Cells(CFG_EXTENSIONS_ROW, 2).Value))) = 0 Then
        ws.Cells(CFG_EXTENSIONS_ROW, 2).Value = DEFAULT_EXTENSIONS
    End If
    If createdNew Or Len(Trim$(CStr(ws.Cells(CFG_DATA_SHEET_ROW, 2).Value))) = 0 Then
        ws.Cells(CFG_DATA_SHEET_ROW, 2).Value = dataSheetName
    End If
    ws.Cells(CFG_SOURCE_COLUMN_ROW, 2).Value = "AA"
    ws.Cells(CFG_DATE_COLUMN_ROW, 2).Value = "D"

    ws.Range("A16:B16").Merge
    ws.Range("A16").Value = "SYSTEM STATUS"
    ws.Cells(CFG_LAST_SIGNATURE_ROW, 1).Value = "Last Data Signature"
    ws.Cells(CFG_LAST_REFRESH_ROW, 1).Value = "Last Successful Refresh"
    ws.Cells(CFG_INDEX_STATE_ROW, 1).Value = "Image Index State"

    With ws.Range("A1:I2")
        .Interior.Color = RGB(31, 78, 121)
        .Font.Color = RGB(255, 255, 255)
        .Font.Bold = True
        .Font.Size = 16
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
    End With
    ws.Rows("1:2").RowHeight = 24

    With ws.Range("A4:A13")
        .Interior.Color = RGB(221, 235, 247)
        .Font.Bold = True
        .Font.Color = RGB(31, 78, 121)
        .VerticalAlignment = xlCenter
    End With
    With ws.Range("B4:B13")
        .Interior.Color = RGB(255, 255, 255)
        .Font.Color = RGB(31, 31, 31)
        .WrapText = True
        .VerticalAlignment = xlCenter
        .Borders(xlEdgeBottom).Color = RGB(189, 215, 238)
    End With
    With ws.Range("A16:B16")
        .Interior.Color = RGB(68, 114, 196)
        .Font.Color = RGB(255, 255, 255)
        .Font.Bold = True
        .HorizontalAlignment = xlCenter
    End With
    With ws.Range("A17:A19")
        .Interior.Color = RGB(242, 242, 242)
        .Font.Bold = True
    End With

    ws.Columns("A").ColumnWidth = 32
    ws.Columns("B").ColumnWidth = 58
    ws.Columns("C").ColumnWidth = 3
    ws.Columns("D:I").ColumnWidth = 14
    ws.Rows("4:13").RowHeight = 28
    ws.Rows("17:19").RowHeight = 24
    ws.Cells(CFG_INTERVAL_ROW, 2).NumberFormat = "0"
    ws.Cells(CFG_LAST_REFRESH_ROW, 2).NumberFormat = "yyyy-mm-dd hh:mm:ss"

    listSeparator = Application.International(xlListSeparator)
    EDV_SetListValidation ws.Cells(CFG_INCLUDE_SUBFOLDERS_ROW, 2), _
                          "YES" & listSeparator & "NO"
    EDV_SetListValidation ws.Cells(CFG_REFRESH_CHANGED_ROW, 2), _
                          "YES" & listSeparator & "NO"
    EDV_SetListValidation ws.Cells(CFG_AUTO_ENABLED_ROW, 2), _
                          "YES" & listSeparator & "NO"

    EDV_DeleteButtonShapes ws
    EDV_AddButton ws, "EDV_BUTTON_SELECT_SERVER", "D4", _
                  "SELECT SERVER FOLDER", "EDV_Select_Server_Folder", RGB(68, 114, 196)
    EDV_AddButton ws, "EDV_BUTTON_SELECT_LOCAL", "G4", _
                  "SELECT LOCAL OUTPUT FOLDER", "EDV_Select_Local_Output_Folder", RGB(68, 114, 196)
    EDV_AddButton ws, "EDV_BUTTON_COPY_PREVIEW", "D7", _
                  "COPY + PREVIEW ALL", "EDV_Copy_Then_Preview_All", RGB(0, 112, 60)
    EDV_AddButton ws, "EDV_BUTTON_FORCE", "G7", _
                  "FORCE REINDEX + UPDATE", "EDV_Force_Reindex_Update", RGB(0, 112, 60)
    EDV_AddButton ws, "EDV_BUTTON_REVIEW", "D10", _
                  "REVIEW SELECTED ROW", "EDV_Review_Selected_Row", RGB(112, 48, 160)
    EDV_AddButton ws, "EDV_BUTTON_OPEN_FOLDER", "G10", _
                  "OPEN LOCAL IMAGE FOLDER", "EDV_Open_Local_Image_Folder", RGB(112, 48, 160)
    EDV_AddButton ws, "EDV_BUTTON_ENABLE_AUTO", "D13", _
                  "ENABLE AUTO REFRESH", "EDV_Enable_Auto_Refresh", RGB(0, 153, 102)
    EDV_AddButton ws, "EDV_BUTTON_DISABLE_AUTO", "G13", _
                  "DISABLE AUTO REFRESH", "EDV_Disable_Auto_Refresh", RGB(192, 80, 77)

    ws.Tab.Color = RGB(68, 114, 196)
    ws.Activate
    ActiveWindow.DisplayGridlines = False
    Set EDV_CreateOrUpdateConfigSheet = ws
End Function

Private Function EDV_CreateOrUpdateReviewSheet() As Worksheet
    Dim ws As Worksheet
    Dim resultList As String

    Set ws = EDV_GetWorksheetIfExists(EDV_REVIEW_SHEET)
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add( _
                 After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ws.Name = EDV_REVIEW_SHEET
    End If

    On Error Resume Next
    ws.Range("A1:H2").UnMerge
    ws.Range("B4:C13").UnMerge
    ws.Range("D4:H13").UnMerge
    ws.Range("B16:H16").UnMerge
    ws.Range("B17:H18").UnMerge
    On Error GoTo 0

    ws.Range("A1:H2").Merge
    ws.Range("A1").Value = "EDV TRANSACTION - MANUAL IMAGE REVIEW"

    ws.Range("B4:C4").Merge
    ws.Range("B5:C5").Merge
    ws.Range("B6:C6").Merge
    ws.Range("B7:C7").Merge
    ws.Range("B8:C8").Merge
    ws.Range("B9:C9").Merge
    ws.Range("B10:C10").Merge
    ws.Range("B11:C11").Merge
    ws.Range("B12:C12").Merge
    ws.Range("B13:C13").Merge
    ws.Range("D4:H13").Merge
    ws.Range("B16:H16").Merge
    ws.Range("B17:H18").Merge

    ws.Range("A4:A13").Value = Application.Transpose(Array( _
        "Transaction ID", "Vehicle Number", "Lane", "Shift Date", _
        "Transaction Date", "TC MOP", "Validator MOP", "Operator name", _
        "Validator name", "Copy status"))
    ws.Range("A16").Value = "Verification Result"
    ws.Range("A17").Value = "MOL Remark"
    ws.Range("A19").Value = "Verified By"
    ws.Range("D19").Value = "Verification Date"

    With ws.Range("A1:H2")
        .Interior.Color = RGB(31, 78, 121)
        .Font.Color = RGB(255, 255, 255)
        .Font.Bold = True
        .Font.Size = 16
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
    End With
    With ws.Range("A4:A13")
        .Interior.Color = RGB(221, 235, 247)
        .Font.Bold = True
        .Font.Color = RGB(31, 78, 121)
        .VerticalAlignment = xlCenter
    End With
    With ws.Range("B4:C13")
        .Interior.Color = RGB(255, 255, 255)
        .VerticalAlignment = xlCenter
        .WrapText = True
        .Borders(xlEdgeBottom).Color = RGB(217, 217, 217)
    End With
    With ws.Range("D4:H13")
        .Interior.Color = RGB(242, 242, 242)
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(189, 215, 238)
    End With
    With ws.Range("A16:A19")
        .Interior.Color = RGB(221, 235, 247)
        .Font.Bold = True
        .Font.Color = RGB(31, 78, 121)
    End With
    With ws.Range("B16:H18")
        .Interior.Color = RGB(255, 255, 255)
        .WrapText = True
        .VerticalAlignment = xlTop
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(217, 217, 217)
    End With

    ws.Columns("A").ColumnWidth = 22
    ws.Columns("B:C").ColumnWidth = 18
    ws.Columns("D:H").ColumnWidth = 14
    ws.Columns("J").Hidden = True
    ws.Rows("1:2").RowHeight = 24
    ws.Rows("4:13").RowHeight = 27
    ws.Rows("17:18").RowHeight = 32
    ws.Range("B7").NumberFormat = "yyyy-mm-dd"
    ws.Range("B8").NumberFormat = "yyyy-mm-dd hh:mm:ss"
    ws.Range("E19").NumberFormat = "yyyy-mm-dd hh:mm"

    resultList = EDV_VerificationResultList( _
                 Application.International(xlListSeparator))
    EDV_SetListValidation ws.Range("B16"), resultList

    EDV_DeleteButtonShapes ws
    EDV_AddButton ws, "EDV_BUTTON_SAVE_REVIEW", "A22", _
                  "SAVE VERIFICATION", "EDV_Save_Review", RGB(0, 112, 60)
    EDV_AddButton ws, "EDV_BUTTON_OPEN_REVIEW_IMAGE", "D22", _
                  "OPEN LOCAL IMAGE", "EDV_Open_Review_Image", RGB(68, 114, 196)
    EDV_AddButton ws, "EDV_BUTTON_RETURN_DATA", "G22", _
                  "RETURN TO DATA", "EDV_Return_To_Data", RGB(112, 48, 160)

    ws.Tab.Color = RGB(112, 48, 160)
    Set EDV_CreateOrUpdateReviewSheet = ws
End Function

Private Sub EDV_EnsureOutputHeaders(ByVal ws As Worksheet)
    Dim headers As Variant
    Dim headerValues(1 To 1, 1 To 10) As Variant
    Dim i As Long

    headers = Array("EDV Copy Status", "EDV Image Preview", "Open Image Link", _
                    "Local Image Path", "Server Image Path", _
                    "Verification Result", "MOL Remark", "Verified By", _
                    "Verification Date", "Last Updated")
    For i = LBound(headers) To UBound(headers)
        headerValues(1, i + 1) = headers(i)
    Next i
    ws.Range("AB1:AK1").Value = headerValues

    With ws.Range("AB1:AK1")
        .Interior.Color = RGB(31, 78, 121)
        .Font.Color = RGB(255, 255, 255)
        .Font.Bold = True
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
        .WrapText = True
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(217, 225, 242)
    End With

    ws.Columns(COL_COPY_STATUS).ColumnWidth = 17
    ws.Columns(COL_PREVIEW).ColumnWidth = 28
    ws.Columns(COL_OPEN_LINK).ColumnWidth = 16
    ws.Columns(COL_LOCAL_PATH).ColumnWidth = 42
    ws.Columns(COL_SERVER_PATH).ColumnWidth = 42
    ws.Columns(COL_VERIFY_RESULT).ColumnWidth = 28
    ws.Columns(COL_MOL_REMARK).ColumnWidth = 45
    ws.Columns(COL_VERIFIED_BY).ColumnWidth = 20
    ws.Columns(COL_VERIFY_DATE).ColumnWidth = 20
    ws.Columns(COL_LAST_UPDATED).ColumnWidth = 20
    ws.Columns(COL_VERIFY_DATE).NumberFormat = "yyyy-mm-dd hh:mm"
    ws.Columns(COL_LAST_UPDATED).NumberFormat = "yyyy-mm-dd hh:mm:ss"
End Sub

Private Sub EDV_AddButton(ByVal ws As Worksheet, _
                          ByVal shapeName As String, _
                          ByVal anchorCell As String, _
                          ByVal caption As String, _
                          ByVal macroName As String, _
                          ByVal fillColor As Long)
    Dim anchor As Range
    Dim buttonShape As Shape

    Set anchor = ws.Range(anchorCell)
    Set buttonShape = ws.Shapes.AddShape(5, anchor.Left, anchor.Top, 185, 36)
    With buttonShape
        .Name = shapeName
        .TextFrame.Characters.Text = caption
        .TextFrame.HorizontalAlignment = xlHAlignCenter
        .TextFrame.VerticalAlignment = xlVAlignCenter
        .TextFrame.Characters.Font.Bold = True
        .TextFrame.Characters.Font.Color = RGB(255, 255, 255)
        .TextFrame.Characters.Font.Size = 10
        .Fill.ForeColor.RGB = fillColor
        .Line.Visible = 0
        .OnAction = "'" & Replace(ThisWorkbook.Name, "'", "''") & _
                    "'!" & macroName
        .Placement = xlFreeFloating
    End With
End Sub

Private Sub EDV_DeleteButtonShapes(ByVal ws As Worksheet)
    Dim i As Long
    For i = ws.Shapes.Count To 1 Step -1
        If UCase$(Left$(ws.Shapes(i).Name, 11)) = "EDV_BUTTON_" Then
            ws.Shapes(i).Delete
        End If
    Next i
End Sub

Private Sub EDV_SetListValidation(ByVal target As Range, ByVal listText As String)
    On Error Resume Next
    target.Validation.Delete
    On Error GoTo 0
    target.Validation.Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, _
                          Operator:=xlBetween, Formula1:=listText
    target.Validation.IgnoreBlank = True
    target.Validation.InCellDropdown = True
    target.Validation.ErrorTitle = "Invalid selection"
    target.Validation.ErrorMessage = "Choose a value from the list."
    target.Validation.ShowError = True
End Sub

' =============================================================================
' Review helpers
' =============================================================================

Private Sub EDV_PlaceReviewPreview(ByVal reviewWs As Worksheet, _
                                   ByVal localPath As String)
    Dim i As Long
    Dim targetRange As Range
    Dim pictureShape As Shape
    Dim fso As Object
    Dim maxWidth As Double
    Dim maxHeight As Double
    Dim scaleFactor As Double

    For i = reviewWs.Shapes.Count To 1 Step -1
        If UCase$(reviewWs.Shapes(i).Name) = UCase$(EDV_REVIEW_PREVIEW) Then
            reviewWs.Shapes(i).Delete
        End If
    Next i

    Set targetRange = reviewWs.Range("D4:H13")
    targetRange.ClearContents
    Set fso = CreateObject("Scripting.FileSystemObject")

    If Len(localPath) = 0 Or Not fso.FileExists(localPath) Then
        targetRange.Value = "Not Available"
        targetRange.HorizontalAlignment = xlCenter
        targetRange.VerticalAlignment = xlCenter
        Exit Sub
    End If

    On Error Resume Next
    Set pictureShape = reviewWs.Shapes.AddPicture( _
        Filename:=localPath, LinkToFile:=True, SaveWithDocument:=False, _
        Left:=targetRange.Left + 6, Top:=targetRange.Top + 6, _
        Width:=-1, Height:=-1)
    On Error GoTo 0

    If pictureShape Is Nothing Then
        targetRange.Value = "Not Available"
        Exit Sub
    End If

    pictureShape.Name = EDV_REVIEW_PREVIEW
    pictureShape.LockAspectRatio = -1
    maxWidth = targetRange.Width - 12
    maxHeight = targetRange.Height - 12
    scaleFactor = 1#

    If pictureShape.Width > maxWidth Then scaleFactor = maxWidth / pictureShape.Width
    If pictureShape.Height * scaleFactor > maxHeight Then
        scaleFactor = maxHeight / pictureShape.Height
    End If
    If scaleFactor < 1# Then pictureShape.Width = pictureShape.Width * scaleFactor

    pictureShape.Left = targetRange.Left + (targetRange.Width - pictureShape.Width) / 2
    pictureShape.Top = targetRange.Top + (targetRange.Height - pictureShape.Height) / 2
    pictureShape.Placement = xlMoveAndSize
End Sub

Private Function EDV_GenerateMOLRemark(ByVal resultText As String, _
                                       ByVal transactionId As String, _
                                       ByVal vehicleNumber As String) As String
    Dim subjectText As String
    subjectText = "transaction " & transactionId
    If Len(vehicleNumber) > 0 Then subjectText = subjectText & _
        " (vehicle " & vehicleNumber & ")"

    Select Case resultText
        Case "DISCREPANCY CONFIRMED"
            EDV_GenerateMOLRemark = "EDV discrepancy confirmed after manual image review for " & subjectText & "."
        Case "VALID EXEMPTION"
            EDV_GenerateMOLRemark = "EDV image manually reviewed; the exemption is valid for " & subjectText & "."
        Case "DIFFERENT VEHICLE"
            EDV_GenerateMOLRemark = "Manual image review indicates a different vehicle for " & subjectText & "."
        Case "VRN READING ERROR"
            EDV_GenerateMOLRemark = "Manual image review indicates a vehicle registration reading error for " & subjectText & "."
        Case "IMAGE NOT CLEAR"
            EDV_GenerateMOLRemark = "The EDV image is not sufficiently clear for a conclusive manual review of " & subjectText & "."
        Case "IMAGE NOT AVAILABLE"
            EDV_GenerateMOLRemark = "The EDV image is not available for manual verification of " & subjectText & "."
        Case Else
            EDV_GenerateMOLRemark = "Further manual verification is required for " & subjectText & "."
    End Select
End Function

Private Function EDV_IsValidVerificationResult(ByVal resultText As String) As Boolean
    Select Case resultText
        Case "DISCREPANCY CONFIRMED", "VALID EXEMPTION", _
             "DIFFERENT VEHICLE", "VRN READING ERROR", _
             "IMAGE NOT CLEAR", "IMAGE NOT AVAILABLE", _
             "FURTHER VERIFICATION REQUIRED"
            EDV_IsValidVerificationResult = True
    End Select
End Function

Private Function EDV_VerificationResultList(ByVal separatorText As String) As String
    EDV_VerificationResultList = _
        "DISCREPANCY CONFIRMED" & separatorText & _
        "VALID EXEMPTION" & separatorText & _
        "DIFFERENT VEHICLE" & separatorText & _
        "VRN READING ERROR" & separatorText & _
        "IMAGE NOT CLEAR" & separatorText & _
        "IMAGE NOT AVAILABLE" & separatorText & _
        "FURTHER VERIFICATION REQUIRED"
End Function

' =============================================================================
' Automatic refresh helpers
' =============================================================================

Private Sub EDV_ScheduleNextRefresh()
    Dim intervalSeconds As Long

    On Error GoTo ScheduleError
    If gEDVClosing Or gEDVAutoScheduled Then Exit Sub
    If Not EDV_IsYes(EDV_GetConfigValue(CFG_AUTO_ENABLED_ROW)) Then Exit Sub

    intervalSeconds = EDV_GetRefreshIntervalSeconds()
    gEDVNextRun = Now + TimeSerial(0, 0, intervalSeconds)
    gEDVOnTimeProcedure = "'" & Replace(ThisWorkbook.Name, "'", "''") & _
                          "'!EDV_AutoRefreshTick"
    Application.OnTime EarliestTime:=gEDVNextRun, _
                       Procedure:=gEDVOnTimeProcedure, Schedule:=True
    gEDVAutoScheduled = True
    Exit Sub

ScheduleError:
    gEDVAutoScheduled = False
End Sub

Private Sub EDV_CancelScheduledRefresh()
    On Error Resume Next
    If gEDVAutoScheduled And gEDVNextRun > 0 And _
       Len(gEDVOnTimeProcedure) > 0 Then
        Application.OnTime EarliestTime:=gEDVNextRun, _
                           Procedure:=gEDVOnTimeProcedure, Schedule:=False
    End If
    gEDVAutoScheduled = False
    gEDVNextRun = 0
    gEDVOnTimeProcedure = vbNullString
    On Error GoTo 0
End Sub

Private Function EDV_GetRefreshIntervalSeconds() As Long
    Dim intervalValue As Long
    intervalValue = CLng(Val(CStr(EDV_GetConfigValue(CFG_INTERVAL_ROW))))
    If intervalValue < MIN_INTERVAL_SECONDS Then intervalValue = MIN_INTERVAL_SECONDS
    EDV_GetRefreshIntervalSeconds = intervalValue
End Function

' =============================================================================
' General helpers
' =============================================================================

Private Function EDV_GetInitialDataSheet() As Worksheet
    Dim ws As Worksheet
    Dim configuredName As String

    If EDV_ConfigExists Then
        configuredName = Trim$(CStr(EDV_GetConfigValue(CFG_DATA_SHEET_ROW)))
        Set ws = EDV_GetWorksheetIfExists(configuredName)
        If Not ws Is Nothing Then
            If ws.Name <> EDV_CONFIG_SHEET And ws.Name <> EDV_REVIEW_SHEET Then
                Set EDV_GetInitialDataSheet = ws
                Exit Function
            End If
        End If
    End If

    If TypeName(ActiveSheet) = "Worksheet" Then
        Set ws = ActiveSheet
        If ws.Parent Is ThisWorkbook Then
            If ws.Name <> EDV_CONFIG_SHEET And ws.Name <> EDV_REVIEW_SHEET Then
                Set EDV_GetInitialDataSheet = ws
                Exit Function
            End If
        End If
    End If

    For Each ws In ThisWorkbook.Worksheets
        If ws.Name <> EDV_CONFIG_SHEET And ws.Name <> EDV_REVIEW_SHEET Then
            Set EDV_GetInitialDataSheet = ws
            Exit Function
        End If
    Next ws
End Function

Private Function EDV_GetConfiguredDataSheet(ByVal showMessage As Boolean) As Worksheet
    Dim sheetName As String
    Dim ws As Worksheet

    If Not EDV_ConfigExists Then Exit Function
    sheetName = Trim$(CStr(EDV_GetConfigValue(CFG_DATA_SHEET_ROW)))
    Set ws = EDV_GetWorksheetIfExists(sheetName)
    If ws Is Nothing And showMessage Then
        MsgBox "The configured data sheet '" & sheetName & "' was not found.", _
               vbExclamation, "EDV Image Verification"
    End If
    Set EDV_GetConfiguredDataSheet = ws
End Function

Private Function EDV_GetWorksheetIfExists(ByVal sheetName As String) As Worksheet
    If Len(sheetName) = 0 Then Exit Function
    On Error Resume Next
    Set EDV_GetWorksheetIfExists = ThisWorkbook.Worksheets(sheetName)
    On Error GoTo 0
End Function

Private Function EDV_ConfigExists() As Boolean
    Dim ws As Worksheet
    Set ws = EDV_GetWorksheetIfExists(EDV_CONFIG_SHEET)
    EDV_ConfigExists = Not ws Is Nothing
End Function

Private Function EDV_GetConfigValue(ByVal configRow As Long) As Variant
    If EDV_ConfigExists Then
        EDV_GetConfigValue = ThisWorkbook.Worksheets(EDV_CONFIG_SHEET). _
                             Cells(configRow, 2).Value
    End If
End Function

Private Sub EDV_SetConfigValue(ByVal configRow As Long, ByVal newValue As Variant)
    If EDV_ConfigExists Then
        ThisWorkbook.Worksheets(EDV_CONFIG_SHEET).Cells(configRow, 2).Value = newValue
    End If
End Sub

Private Function EDV_LastDataRow(ByVal ws As Worksheet) As Long
    Dim lastTransaction As Long
    Dim lastLane As Long
    Dim lastDate As Long
    Dim lastSource As Long

    lastTransaction = ws.Cells(ws.Rows.Count, COL_TRANSACTION_ID).End(xlUp).Row
    lastLane = ws.Cells(ws.Rows.Count, COL_LANE).End(xlUp).Row
    lastDate = ws.Cells(ws.Rows.Count, COL_SHIFT_DATE).End(xlUp).Row
    lastSource = ws.Cells(ws.Rows.Count, COL_SOURCE).End(xlUp).Row
    EDV_LastDataRow = Application.Max(lastTransaction, lastLane, lastDate, lastSource)
End Function

Private Function EDV_CurrentDataSignature(ByVal ws As Worksheet) As String
    Dim lastRow As Long
    Dim dataValues As Variant

    lastRow = EDV_LastDataRow(ws)
    If lastRow < EDV_FIRST_DATA_ROW Then
        EDV_CurrentDataSignature = "EMPTY"
        Exit Function
    End If

    dataValues = ws.Range(ws.Cells(EDV_FIRST_DATA_ROW, 1), _
                          ws.Cells(lastRow, COL_SOURCE)).Value2
    EDV_CurrentDataSignature = EDV_ComputeDataSignature(dataValues)
End Function

Private Function EDV_ComputeDataSignature(ByVal dataValues As Variant) As String
    Dim i As Long
    Dim j As Long
    Dim textValue As String
    Dim hashValue As Double
    Dim characterCode As Long

    hashValue = 216613626#
    For i = 1 To UBound(dataValues, 1)
        textValue = EDV_ValueToId(dataValues(i, COL_TRANSACTION_ID)) & _
                    ChrW$(30) & EDV_SafeText(dataValues(i, COL_SOURCE)) & ChrW$(31)
        For j = 1 To Len(textValue)
            characterCode = AscW(Mid$(textValue, j, 1))
            If characterCode < 0 Then characterCode = characterCode + 65536
            hashValue = (hashValue * 131# + characterCode) Mod 2147483629#
        Next j
    Next i
    EDV_ComputeDataSignature = Hex$(CLng(hashValue)) & ":" & _
                               CStr(UBound(dataValues, 1))
End Function

Private Function EDV_ComputeRequiredSignature(ByVal requiredKeys As Object) As String
    Dim keyItem As Variant
    Dim textValue As String
    Dim i As Long
    Dim hashValue As Double
    Dim characterCode As Long

    hashValue = 5381#
    For Each keyItem In requiredKeys.Keys
        textValue = CStr(keyItem) & ChrW$(31)
        For i = 1 To Len(textValue)
            characterCode = AscW(Mid$(textValue, i, 1))
            If characterCode < 0 Then characterCode = characterCode + 65536
            hashValue = (hashValue * 33# + characterCode) Mod 2147483629#
        Next i
    Next keyItem
    EDV_ComputeRequiredSignature = Hex$(CLng(hashValue)) & ":" & _
                                   CStr(requiredKeys.Count)
End Function

Private Function EDV_BuildExtensionDictionary(ByVal extensionList As String) As Object
    Dim extensions As Object
    Dim cleanedList As String
    Dim parts As Variant
    Dim part As Variant
    Dim extensionText As String

    Set extensions = CreateObject("Scripting.Dictionary")
    extensions.CompareMode = vbTextCompare
    cleanedList = Replace(extensionList, ",", ";")
    cleanedList = Replace(cleanedList, "|", ";")
    cleanedList = Replace(cleanedList, " ", ";")
    parts = Split(cleanedList, ";")

    For Each part In parts
        extensionText = LCase$(Trim$(CStr(part)))
        If Left$(extensionText, 1) = "." Then extensionText = Mid$(extensionText, 2)
        If Len(extensionText) > 0 Then
            If Not extensions.Exists(extensionText) Then extensions.Add extensionText, True
        End If
    Next part

    If extensions.Count = 0 Then
        For Each part In Split(LCase$(DEFAULT_EXTENSIONS), ";")
            extensions.Add CStr(part), True
        Next part
    End If
    Set EDV_BuildExtensionDictionary = extensions
End Function

Private Function EDV_NormalizedExtensionList(ByVal extensions As Object) As String
    Dim keyItem As Variant
    For Each keyItem In extensions.Keys
        EDV_NormalizedExtensionList = EDV_NormalizedExtensionList & _
                                      ";" & LCase$(CStr(keyItem))
    Next keyItem
End Function

Private Function EDV_FindHeaderColumn(ByVal ws As Worksheet, _
                                      ByVal aliases As Variant, _
                                      ByVal fallbackColumn As Long) As Long
    Dim lastColumn As Long
    Dim columnNumber As Long
    Dim aliasItem As Variant
    Dim headerText As String

    lastColumn = ws.Cells(EDV_HEADER_ROW, ws.Columns.Count).End(xlToLeft).Column
    For columnNumber = 1 To lastColumn
        headerText = EDV_NormalizeHeader(CStr(ws.Cells(EDV_HEADER_ROW, columnNumber).Value))
        For Each aliasItem In aliases
            If headerText = EDV_NormalizeHeader(CStr(aliasItem)) Then
                EDV_FindHeaderColumn = columnNumber
                Exit Function
            End If
        Next aliasItem
    Next columnNumber
    EDV_FindHeaderColumn = fallbackColumn
End Function

Private Function EDV_NormalizeHeader(ByVal textValue As String) As String
    textValue = UCase$(Trim$(textValue))
    textValue = Replace(textValue, " ", vbNullString)
    textValue = Replace(textValue, "-", vbNullString)
    textValue = Replace(textValue, "_", vbNullString)
    textValue = Replace(textValue, "/", vbNullString)
    EDV_NormalizeHeader = textValue
End Function

Private Function EDV_ValueToId(ByVal valueItem As Variant) As String
    If IsError(valueItem) Or IsEmpty(valueItem) Or IsNull(valueItem) Then Exit Function
    If IsNumeric(valueItem) And Len(Trim$(CStr(valueItem))) > 0 Then
        EDV_ValueToId = Format$(CDbl(valueItem), "0")
    Else
        EDV_ValueToId = Trim$(CStr(valueItem))
    End If
End Function

Private Function EDV_SafeText(ByVal valueItem As Variant) As String
    If IsError(valueItem) Or IsEmpty(valueItem) Or IsNull(valueItem) Then Exit Function
    EDV_SafeText = Trim$(CStr(valueItem))
End Function

Private Function EDV_DateFolderName(ByVal valueItem As Variant) As String
    On Error GoTo UnknownDate
    If IsDate(valueItem) Or IsNumeric(valueItem) Then
        EDV_DateFolderName = Format$(CDate(valueItem), "yyyy-mm-dd")
        Exit Function
    End If

UnknownDate:
    EDV_DateFolderName = "Unknown-Date"
    Err.Clear
End Function

Private Function EDV_SanitizeFolderName(ByVal valueText As String, _
                                        ByVal fallbackText As String) As String
    Dim invalidCharacters As Variant
    Dim item As Variant

    valueText = Trim$(valueText)
    invalidCharacters = Array("\", "/", ":", "*", "?", Chr$(34), "<", ">", "|")
    For Each item In invalidCharacters
        valueText = Replace(valueText, CStr(item), "_")
    Next item
    Do While Right$(valueText, 1) = "." Or Right$(valueText, 1) = " "
        valueText = Left$(valueText, Len(valueText) - 1)
        If Len(valueText) = 0 Then Exit Do
    Loop
    If Len(valueText) = 0 Then valueText = fallbackText
    EDV_SanitizeFolderName = valueText
End Function

Private Function EDV_NormalizeKey(ByVal valueText As String) As String
    EDV_NormalizeKey = LCase$(Trim$(valueText))
End Function

Private Function EDV_LooksLikeFullPath(ByVal valueText As String) As Boolean
    valueText = Trim$(valueText)
    EDV_LooksLikeFullPath = (Len(valueText) >= 3 And Mid$(valueText, 2, 2) = ":\") Or _
                            (Left$(valueText, 2) = "\\")
End Function

Private Function EDV_PathIsWithinRoot(ByVal filePath As String, _
                                      ByVal rootPath As String, _
                                      ByVal fso As Object) As Boolean
    Dim normalizedFile As String
    Dim normalizedRoot As String

    On Error GoTo PathExit
    normalizedFile = LCase$(fso.GetAbsolutePathName(filePath))
    normalizedRoot = LCase$(EDV_TrimTrailingSlash( _
                     fso.GetAbsolutePathName(rootPath)))
    If Right$(normalizedRoot, 1) <> "\" Then normalizedRoot = normalizedRoot & "\"
    EDV_PathIsWithinRoot = (Left$(normalizedFile, Len(normalizedRoot)) = normalizedRoot)

PathExit:
    Err.Clear
End Function

Private Sub EDV_EnsureFolderExists(ByVal folderPath As String, ByVal fso As Object)
    Dim parentPath As String

    If Len(folderPath) = 0 Then
        Err.Raise vbObjectError + 2104, "EDV_EnsureFolderExists", _
                  "The local output folder is blank."
    End If
    If fso.FolderExists(folderPath) Then Exit Sub

    parentPath = fso.GetParentFolderName(folderPath)
    If Len(parentPath) > 0 And parentPath <> folderPath Then
        If Not fso.FolderExists(parentPath) Then EDV_EnsureFolderExists parentPath, fso
    End If
    fso.CreateFolder folderPath
End Sub

Private Function EDV_CombinePath(ByVal parentPath As String, _
                                 ByVal childName As String) As String
    parentPath = EDV_TrimTrailingSlash(parentPath)
    If Right$(parentPath, 1) = "\" Then
        EDV_CombinePath = parentPath & childName
    Else
        EDV_CombinePath = parentPath & "\" & childName
    End If
End Function

Private Function EDV_TrimTrailingSlash(ByVal folderPath As String) As String
    folderPath = Trim$(folderPath)
    Do While Len(folderPath) > 3 And _
             (Right$(folderPath, 1) = "\" Or Right$(folderPath, 1) = "/")
        folderPath = Left$(folderPath, Len(folderPath) - 1)
    Loop
    EDV_TrimTrailingSlash = folderPath
End Function

Private Function EDV_DefaultLocalFolder() As String
    EDV_DefaultLocalFolder = Environ$("USERPROFILE") & _
                             "\Documents\EDV_Verification_Images"
End Function

Private Function EDV_PickFolder(ByVal dialogTitle As String, _
                                ByVal initialPath As String) As String
    Dim picker As Object

    Set picker = Application.FileDialog(4)
    With picker
        .Title = dialogTitle
        .AllowMultiSelect = False
        If Len(initialPath) > 0 Then .InitialFileName = initialPath
        If .Show = -1 Then EDV_PickFolder = .SelectedItems(1)
    End With
End Function

Private Function EDV_IsYes(ByVal valueItem As Variant) As Boolean
    EDV_IsYes = (UCase$(Trim$(CStr(valueItem))) = "YES")
End Function

Private Sub EDV_LoadExistingColumnValues(ByVal ws As Worksheet, _
                                         ByVal firstRow As Long, _
                                         ByVal lastRow As Long, _
                                         ByVal columnNumber As Long, _
                                         ByRef outputValues() As Variant)
    Dim existingValues As Variant
    Dim i As Long

    existingValues = EDV_ReadSingleColumn(ws, firstRow, lastRow, columnNumber)
    For i = 1 To UBound(existingValues, 1)
        outputValues(i, 1) = existingValues(i, 1)
    Next i
End Sub

Private Function EDV_ReadSingleColumn(ByVal ws As Worksheet, _
                                      ByVal firstRow As Long, _
                                      ByVal lastRow As Long, _
                                      ByVal columnNumber As Long) As Variant
    Dim sourceValue As Variant
    Dim resultValues() As Variant
    Dim rowCount As Long

    rowCount = lastRow - firstRow + 1
    ReDim resultValues(1 To rowCount, 1 To 1)
    sourceValue = ws.Range(ws.Cells(firstRow, columnNumber), _
                           ws.Cells(lastRow, columnNumber)).Value2

    If rowCount = 1 Then
        resultValues(1, 1) = sourceValue
    Else
        EDV_ReadSingleColumn = sourceValue
        Exit Function
    End If
    EDV_ReadSingleColumn = resultValues
End Function

Private Sub EDV_DeletePreviewShapes(ByVal ws As Worksheet)
    Dim i As Long
    For i = ws.Shapes.Count To 1 Step -1
        If UCase$(Left$(ws.Shapes(i).Name, Len(EDV_PREVIEW_PREFIX))) = _
           UCase$(EDV_PREVIEW_PREFIX) Then
            ws.Shapes(i).Delete
        End If
    Next i
End Sub

Private Function EDV_CompletionMessage(ByRef stats As EDVProcessStats, _
                                       ByVal elapsedSeconds As Double) As String
    EDV_CompletionMessage = _
        "Processing completed successfully." & vbCrLf & vbCrLf & _
        "Total transaction rows: " & Format$(stats.TotalRows, "#,##0") & vbCrLf & _
        "Images copied: " & Format$(stats.Copied, "#,##0") & vbCrLf & _
        "Images updated: " & Format$(stats.Updated, "#,##0") & vbCrLf & _
        "Images already up to date: " & Format$(stats.UpToDate, "#,##0") & vbCrLf & _
        "Images not found: " & Format$(stats.NotFound, "#,##0") & vbCrLf & _
        "Copy errors: " & Format$(stats.CopyErrors, "#,##0") & vbCrLf & _
        "Excel previews created: " & Format$(stats.Previews, "#,##0") & vbCrLf & _
        "Total processing time: " & Format$(elapsedSeconds, "0.0") & " seconds"
End Function
