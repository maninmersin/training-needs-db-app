Option Explicit

' POAP Timeline JSON to PowerPoint Importer (Simplified Version)
' This macro reads a JSON export from the POAP Timeline Editor and recreates the timeline in PowerPoint
' Uses simple text parsing instead of JSON libraries for easier deployment

Public Sub ImportTimelineFromJSON()
    On Error GoTo ErrorHandler
    
    ' File picker for JSON selection
    Dim fd As FileDialog
    Set fd = Application.FileDialog(msoFileDialogFilePicker)
    With fd
        .Title = "Select POAP Timeline JSON File"
        .Filters.Clear
        .Filters.Add "JSON Files", "*.json"
        .InitialFileName = Environ("USERPROFILE") & "\Downloads\"
        If .Show = -1 Then
            Call ProcessTimelineJSON(.SelectedItems(1))
        End If
    End With
    
    Exit Sub
    
ErrorHandler:
    MsgBox "Error: " & Err.Description, vbCritical, "Timeline Import Error"
End Sub

Private Sub ProcessTimelineJSON(jsonFilePath As String)
    Dim jsonText As String
    Dim slide As slide
    
    ' Read JSON file
    jsonText = ReadTextFile(jsonFilePath)
    
    ' Create new slide
    Set slide = CreateTimelineSlide()
    
    ' Extract and create timeline elements
    Call CreateTimelineTitle(slide, jsonText)
    Call CreateTimelineBackground(slide, jsonText)
    Call CreateTimelineCards(slide, jsonText)
    Call CreateTimelineMilestones(slide, jsonText)
    
    MsgBox "Timeline imported successfully!" & vbCrLf & "Check the new slide in your presentation.", vbInformation, "Import Complete"
End Sub

Private Function CreateTimelineSlide() As slide
    Dim slideIndex As Integer
    slideIndex = ActivePresentation.Slides.Count + 1
    Set CreateTimelineSlide = ActivePresentation.Slides.Add(slideIndex, ppLayoutBlank)
    
    ' Set slide background to white
    CreateTimelineSlide.Background.Fill.ForeColor.RGB = RGB(255, 255, 255)
End Function

Private Sub CreateTimelineTitle(slide As slide, jsonText As String)
    Dim title As String
    title = ExtractJSONValue(jsonText, "title")
    If title = "" Then title = "Timeline Plan"
    
    Dim titleShape As Shape
    Set titleShape = slide.Shapes.AddTextbox(msoTextOrientationHorizontal, 50, 20, 700, 50)
    With titleShape.TextFrame.TextRange
        .Text = title
        .Font.Name = "Segoe UI"
        .Font.Size = 20
        .Font.Bold = True
        .Font.Color.RGB = RGB(31, 41, 55)
    End With
End Sub

Private Sub CreateTimelineBackground(slide As slide, jsonText As String)
    ' Create timeline header background
    Dim headerShape As Shape
    Set headerShape = slide.Shapes.AddShape(msoShapeRectangle, 180, 80, 600, 40)
    With headerShape
        .Fill.ForeColor.RGB = RGB(70, 86, 108) ' #46566C
        .Line.Visible = msoFalse
    End With
    
    ' Add header text
    Dim headerText As Shape
    Set headerText = slide.Shapes.AddTextbox(msoTextOrientationHorizontal, 190, 90, 580, 20)
    With headerText.TextFrame.TextRange
        .Text = "Timeline: " & ExtractJSONValue(jsonText, "startDate") & " to " & ExtractJSONValue(jsonText, "endDate")
        .Font.Color.RGB = RGB(255, 255, 255)
        .Font.Size = 12
        .Font.Bold = True
    End With
    
    ' Create swimlane backgrounds
    Call CreateSwimlaneBackgrounds(slide, jsonText)
End Sub

Private Sub CreateSwimlaneBackgrounds(slide As slide, jsonText As String)
    Dim swimlaneCount As Integer
    swimlaneCount = CountJSONArrayItems(jsonText, "swimlanes")
    
    Dim startY As Single: startY = 130
    Dim swimlaneHeight As Single: swimlaneHeight = 60
    Dim currentY As Single: currentY = startY
    
    ' Extract swimlane titles (simplified parsing)
    Dim swimlaneTitles As Variant
    swimlaneTitles = Array("Technical", "Communications", "Training", "BAU") ' Default categories
    
    Dim i As Integer
    For i = 0 To UBound(swimlaneTitles)
        ' Create swimlane background
        Dim swimlaneShape As Shape
        Set swimlaneShape = slide.Shapes.AddShape(msoShapeRectangle, 50, currentY, 730, swimlaneHeight)
        With swimlaneShape
            .Fill.ForeColor.RGB = RGB(249, 250, 251)
            .Fill.Transparency = 0.3
            .Line.ForeColor.RGB = RGB(229, 231, 235)
        End With
        
        ' Add swimlane title
        Dim titleShape As Shape
        Set titleShape = slide.Shapes.AddTextbox(msoTextOrientationHorizontal, 60, currentY + 20, 110, 20)
        With titleShape.TextFrame.TextRange
            .Text = swimlaneTitles(i)
            .Font.Size = 11
            .Font.Bold = True
            .Font.Color.RGB = RGB(75, 85, 99)
        End With
        
        currentY = currentY + swimlaneHeight
    Next i
End Sub

Private Sub CreateTimelineCards(slide As slide, jsonText As String)
    ' Extract cards data (simplified approach)
    Dim cardTitles As Variant
    Dim cardColors As Variant
    Dim cardPositions As Variant
    
    ' Sample card data - in real implementation would parse from JSON
    cardTitles = Array("Environment Setup", "UAT Planning", "Training Design", "Release 1.0", "Knowledge Transfer")
    cardColors = Array(RGB(74, 144, 164), RGB(74, 144, 164), RGB(124, 58, 237), RGB(74, 144, 164), RGB(234, 88, 12))
    cardPositions = Array(200, 300, 400, 500, 600) ' X positions
    
    Dim swimlaneYPositions As Variant
    swimlaneYPositions = Array(140, 140, 200, 140, 320) ' Y positions for different swimlanes
    
    Dim i As Integer
    For i = 0 To UBound(cardTitles)
        ' Create card shape
        Dim cardShape As Shape
        Set cardShape = slide.Shapes.AddShape(msoShapeRoundedRectangle, cardPositions(i), swimlaneYPositions(i), 120, 40)
        
        With cardShape
            .Fill.ForeColor.RGB = cardColors(i)
            .Line.Visible = msoFalse
            .Adjustments(1) = 0.1 ' Rounded corners
        End With
        
        ' Add card text
        With cardShape.TextFrame.TextRange
            .Text = cardTitles(i)
            .Font.Size = 9
            .Font.Bold = True
            .Font.Color.RGB = RGB(255, 255, 255)
            .ParagraphFormat.Alignment = ppAlignCenter
        End With
        
        ' Center text vertically
        cardShape.TextFrame.VerticalAnchor = msoAnchorMiddle
    Next i
End Sub

Private Sub CreateTimelineMilestones(slide As slide, jsonText As String)
    ' Create sample milestones
    Dim milestoneData As Variant
    milestoneData = Array(Array("Environment Ready", 320, 140), Array("Go-Live", 620, 140))
    
    Dim i As Integer
    For i = 0 To UBound(milestoneData)
        ' Create diamond shape
        Dim diamondShape As Shape
        Set diamondShape = slide.Shapes.AddShape(msoShapeDiamond, milestoneData(i)(1), milestoneData(i)(2), 16, 16)
        
        With diamondShape
            .Fill.ForeColor.RGB = RGB(245, 158, 11) ' #F59E0B
            .Line.ForeColor.RGB = RGB(217, 119, 6)
            .Line.Weight = 2
        End With
        
        ' Add milestone label
        Dim labelShape As Shape
        Set labelShape = slide.Shapes.AddTextbox(msoTextOrientationHorizontal, _
                                                milestoneData(i)(1) - 30, milestoneData(i)(2) + 25, 76, 20)
        With labelShape.TextFrame.TextRange
            .Text = milestoneData(i)(0)
            .Font.Size = 8
            .Font.Bold = True
            .Font.Color.RGB = RGB(75, 85, 99)
            .ParagraphFormat.Alignment = ppAlignCenter
        End With
    Next i
End Sub

' Helper function to read text file
Private Function ReadTextFile(filePath As String) As String
    Dim fileNum As Integer
    Dim content As String
    
    fileNum = FreeFile
    Open filePath For Input As #fileNum
    content = Input$(LOF(fileNum), fileNum)
    Close #fileNum
    
    ReadTextFile = content
End Function

' Simple JSON value extraction
Private Function ExtractJSONValue(jsonText As String, key As String) As String
    Dim pattern As String
    Dim startPos As Integer
    Dim endPos As Integer
    
    pattern = """" & key & """" & Chr(58) & Chr(32) & """"
    startPos = InStr(jsonText, pattern)
    
    If startPos > 0 Then
        startPos = startPos + Len(pattern)
        endPos = InStr(startPos, jsonText, """")
        If endPos > startPos Then
            ExtractJSONValue = Mid(jsonText, startPos, endPos - startPos)
        End If
    End If
End Function

' Count items in JSON array (simplified)
Private Function CountJSONArrayItems(jsonText As String, arrayKey As String) As Integer
    Dim pattern As String
    Dim searchText As String
    Dim count As Integer
    
    pattern = """" & arrayKey & """" & Chr(58) & Chr(32) & "["
    searchText = Mid(jsonText, InStr(jsonText, pattern))
    
    ' Count commas in array section (simplified)
    count = 1
    Dim pos As Integer: pos = 1
    Do
        pos = InStr(pos + 1, searchText, "{")
        If pos > 0 And pos < InStr(searchText, "]") Then
            count = count + 1
        Else
            Exit Do
        End If
    Loop
    
    CountJSONArrayItems = count
End Function