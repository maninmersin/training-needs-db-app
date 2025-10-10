Attribute VB_Name = "POAP_Timeline_Import"
Option Explicit

' POAP Timeline JSON to PowerPoint Importer
' This macro reads a JSON export from the POAP Timeline Editor and recreates the timeline in PowerPoint
' Created for: Training Needs Database App - POAP Module

' Main function to import timeline from JSON
Sub ImportTimelineFromJSON()
    On Error GoTo ErrorHandler
    
    Dim jsonFilePath As String
    Dim jsonContent As String
    Dim timelineData As Object
    
    ' Get JSON file path from user
    Dim fd As FileDialog
    Set fd = Application.FileDialog(msoFileDialogFilePicker)
    With fd
        .Title = "Select POAP Timeline JSON File"
        .Filters.Clear
        .Filters.Add "JSON Files", "*.json"
        .InitialFileName = Environ("USERPROFILE") & "\Downloads\"
        If .Show = -1 Then
            jsonFilePath = .SelectedItems(1)
        Else
            Exit Sub
        End If
    End With
    
    ' Read JSON file content
    jsonContent = ReadTextFile(jsonFilePath)
    
    ' Parse JSON (requires reference to Microsoft Scripting Runtime)
    Set timelineData = JsonConverter.ParseJson(jsonContent)
    
    ' Create new slide for timeline
    Dim slideIndex As Integer
    slideIndex = ActivePresentation.Slides.Count + 1
    Dim newSlide As Slide
    Set newSlide = ActivePresentation.Slides.Add(slideIndex, ppLayoutBlank)
    
    ' Set slide title
    Dim titleBox As Shape
    Set titleBox = newSlide.Shapes.AddTextbox(msoTextOrientationHorizontal, 50, 20, 600, 50)
    titleBox.TextFrame.TextRange.Text = timelineData("title")
    titleBox.TextFrame.TextRange.Font.Size = 24
    titleBox.TextFrame.TextRange.Font.Bold = True
    
    ' Create timeline structure
    Call CreateTimelineHeader(newSlide, timelineData)
    Call CreateSwimlanes(newSlide, timelineData)
    Call CreateTimelineCards(newSlide, timelineData)
    Call CreateMilestones(newSlide, timelineData)
    Call CreateTextElements(newSlide, timelineData)
    Call CreateShapes(newSlide, timelineData)
    
    MsgBox "Timeline imported successfully!", vbInformation, "POAP Timeline Import"
    Exit Sub
    
ErrorHandler:
    MsgBox "Error importing timeline: " & Err.Description, vbCritical, "Import Error"
End Sub

' Create timeline header (date grid)
Private Sub CreateTimelineHeader(slide As Slide, timelineData As Object)
    Dim timeline As Object
    Set timeline = timelineData("timeline")
    
    ' Timeline parameters
    Dim startX As Single: startX = 200
    Dim startY As Single: startY = 100
    Dim timelineWidth As Single: timelineWidth = 600
    Dim headerHeight As Single: headerHeight = 60
    
    ' Create header background
    Dim headerBox As Shape
    Set headerBox = slide.Shapes.AddShape(msoShapeRectangle, startX, startY, timelineWidth, headerHeight)
    With headerBox
        .Fill.ForeColor.RGB = RGB(70, 86, 108) ' #46566C
        .Line.Visible = msoTrue
        .Line.ForeColor.RGB = RGB(229, 231, 235) ' #e5e7eb
    End With
    
    ' Add timeline scale labels (simplified - would need date parsing for full implementation)
    Dim labelBox As Shape
    Set labelBox = slide.Shapes.AddTextbox(msoTextOrientationHorizontal, startX + 10, startY + 15, timelineWidth - 20, 30)
    labelBox.TextFrame.TextRange.Text = "Timeline: " & timeline("startDate") & " to " & timeline("endDate")
    labelBox.TextFrame.TextRange.Font.Color.RGB = RGB(255, 255, 255)
    labelBox.TextFrame.TextRange.Font.Bold = True
End Sub

' Create swimlanes (background rows)
Private Sub CreateSwimlanes(slide As Slide, timelineData As Object)
    Dim swimlanes As Object
    Set swimlanes = timelineData("swimlanes")
    
    Dim startX As Single: startX = 50
    Dim startY As Single: startY = 160
    Dim swimlaneWidth As Single: swimlaneWidth = 750
    Dim swimlaneHeight As Single: swimlaneHeight = 60
    Dim currentY As Single: currentY = startY
    
    Dim i As Integer
    For i = 0 To swimlanes.Count - 1
        Dim swimlane As Object
        Set swimlane = swimlanes(i)
        
        ' Skip main categories (they don't have timeline tracks)
        If swimlane("isMainCategory") = True Then
            GoTo NextSwimlane
        End If
        
        ' Create swimlane background
        Dim swimlaneBox As Shape
        Set swimlaneBox = slide.Shapes.AddShape(msoShapeRectangle, startX, currentY, swimlaneWidth, swimlaneHeight)
        With swimlaneBox
            .Fill.ForeColor.RGB = RGB(249, 250, 251) ' Light gray background
            .Fill.Transparency = 0.5
            .Line.ForeColor.RGB = RGB(229, 231, 235) ' #e5e7eb
        End With
        
        ' Add swimlane title
        Dim titleBox As Shape
        Set titleBox = slide.Shapes.AddTextbox(msoTextOrientationHorizontal, startX + 10, currentY + 20, 140, 20)
        titleBox.TextFrame.TextRange.Text = swimlane("title")
        titleBox.TextFrame.TextRange.Font.Size = 12
        titleBox.TextFrame.TextRange.Font.Bold = True
        
        currentY = currentY + swimlaneHeight
        
NextSwimlane:
    Next i
End Sub

' Create timeline cards
Private Sub CreateTimelineCards(slide As Slide, timelineData As Object)
    Dim cards As Object
    Set cards = timelineData("cards")
    
    ' Timeline parameters for positioning
    Dim timelineStartX As Single: timelineStartX = 200
    Dim timelineWidth As Single: timelineWidth = 600
    Dim swimlaneStartY As Single: swimlaneStartY = 160
    Dim swimlaneHeight As Single: swimlaneHeight = 60
    
    ' Get timeline date range for positioning calculations
    Dim timeline As Object
    Set timeline = timelineData("timeline")
    
    Dim i As Integer
    For i = 0 To cards.Count - 1
        Dim card As Object
        Set card = cards(i)
        
        ' Calculate card position (simplified - would need proper date parsing)
        Dim cardX As Single: cardX = timelineStartX + (i * 80) ' Simplified positioning
        Dim cardY As Single: cardY = GetSwimlaneY(swimlaneStartY, card("swimlaneId"), timelineData)
        Dim cardWidth As Single: cardWidth = 120
        Dim cardHeight As Single: cardHeight = 40
        
        ' Create card shape
        Dim cardShape As Shape
        Set cardShape = slide.Shapes.AddShape(msoShapeRectangle, cardX, cardY + 10, cardWidth, cardHeight)
        
        ' Set card appearance
        With cardShape
            .Fill.ForeColor.RGB = HexToRGB(Mid(card("color"), 2)) ' Remove # from color
            .Line.ForeColor.RGB = RGB(0, 0, 0)
            .Line.Transparency = 0.9
        End With
        
        ' Add card text
        With cardShape.TextFrame.TextRange
            .Text = card("title")
            .Font.Size = 10
            .Font.Bold = True
            .Font.Color.RGB = RGB(255, 255, 255)
        End With
        
        ' Add description if available
        If card("description") <> "" Then
            Dim descShape As Shape
            Set descShape = slide.Shapes.AddTextbox(msoTextOrientationHorizontal, cardX, cardY + 55, cardWidth, 15)
            descShape.TextFrame.TextRange.Text = card("description")
            descShape.TextFrame.TextRange.Font.Size = 8
            descShape.TextFrame.TextRange.Font.Color.RGB = RGB(100, 100, 100)
        End If
    Next i
End Sub

' Create milestone markers
Private Sub CreateMilestones(slide As Slide, timelineData As Object)
    Dim milestones As Object
    Set milestones = timelineData("milestones")
    
    If milestones Is Nothing Then Exit Sub
    
    Dim timelineStartX As Single: timelineStartX = 200
    Dim swimlaneStartY As Single: swimlaneStartY = 160
    
    Dim i As Integer
    For i = 0 To milestones.Count - 1
        Dim milestone As Object
        Set milestone = milestones(i)
        
        ' Calculate milestone position
        Dim milestoneX As Single: milestoneX = timelineStartX + (i * 100) ' Simplified positioning
        Dim milestoneY As Single: milestoneY = GetSwimlaneY(swimlaneStartY, milestone("swimlaneId"), timelineData)
        
        ' Create diamond shape for milestone
        Dim diamondShape As Shape
        Set diamondShape = slide.Shapes.AddShape(msoShapeDiamond, milestoneX, milestoneY + 20, 20, 20)
        
        With diamondShape
            .Fill.ForeColor.RGB = HexToRGB(Mid(milestone("color"), 2))
            .Line.ForeColor.RGB = RGB(217, 119, 6) ' #D97706
        End With
        
        ' Add milestone label
        Dim labelShape As Shape
        Set labelShape = slide.Shapes.AddTextbox(msoTextOrientationHorizontal, milestoneX - 20, milestoneY + 45, 60, 20)
        labelShape.TextFrame.TextRange.Text = milestone("title")
        labelShape.TextFrame.TextRange.Font.Size = 8
        labelShape.TextFrame.TextRange.Font.Bold = True
    Next i
End Sub

' Create text elements
Private Sub CreateTextElements(slide As Slide, timelineData As Object)
    Dim texts As Object
    Set texts = timelineData("texts")
    
    If texts Is Nothing Then Exit Sub
    
    Dim i As Integer
    For i = 0 To texts.Count - 1
        Dim textElement As Object
        Set textElement = texts(i)
        
        ' Create text box
        Dim textBox As Shape
        Set textBox = slide.Shapes.AddTextbox(msoTextOrientationHorizontal, _
                                             textElement("position")("x"), _
                                             textElement("position")("y"), _
                                             200, 30)
        
        With textBox.TextFrame.TextRange
            .Text = textElement("text")
            .Font.Size = textElement("fontSize")
            .Font.Name = textElement("fontFamily")
            If textElement("fontWeight") = "bold" Then .Font.Bold = True
            .Font.Color.RGB = HexToRGB(Mid(textElement("color"), 2))
        End With
    Next i
End Sub

' Create custom shapes
Private Sub CreateShapes(slide As Slide, timelineData As Object)
    Dim shapes As Object
    Set shapes = timelineData("shapes")
    
    If shapes Is Nothing Then Exit Sub
    
    Dim i As Integer
    For i = 0 To shapes.Count - 1
        Dim shapeElement As Object
        Set shapeElement = shapes(i)
        
        Dim newShape As Shape
        
        ' Create shape based on type
        Select Case shapeElement("shapeType")
            Case "rectangle"
                Set newShape = slide.Shapes.AddShape(msoShapeRectangle, _
                                                   shapeElement("position")("x"), _
                                                   shapeElement("position")("y"), _
                                                   shapeElement("width"), _
                                                   shapeElement("height"))
            Case "circle"
                Set newShape = slide.Shapes.AddShape(msoShapeOval, _
                                                   shapeElement("position")("x"), _
                                                   shapeElement("position")("y"), _
                                                   shapeElement("width"), _
                                                   shapeElement("height"))
            Case "line"
                Set newShape = slide.Shapes.AddLine(shapeElement("position")("x"), _
                                                   shapeElement("position")("y"), _
                                                   shapeElement("position")("x") + shapeElement("width"), _
                                                   shapeElement("position")("y") + shapeElement("height"))
        End Select
        
        ' Set shape appearance
        If Not newShape Is Nothing Then
            newShape.Fill.ForeColor.RGB = HexToRGB(Mid(shapeElement("color"), 2))
        End If
    Next i
End Sub

' Helper function to get swimlane Y position
Private Function GetSwimlaneY(startY As Single, swimlaneId As String, timelineData As Object) As Single
    Dim swimlanes As Object
    Set swimlanes = timelineData("swimlanes")
    
    Dim currentY As Single: currentY = startY
    Dim swimlaneHeight As Single: swimlaneHeight = 60
    
    Dim i As Integer
    For i = 0 To swimlanes.Count - 1
        Dim swimlane As Object
        Set swimlane = swimlanes(i)
        
        If swimlane("isMainCategory") = True Then
            GoTo NextLane
        End If
        
        If swimlane("id") = swimlaneId Then
            GetSwimlaneY = currentY
            Exit Function
        End If
        
        currentY = currentY + swimlaneHeight
        
NextLane:
    Next i
    
    GetSwimlaneY = startY ' Default if not found
End Function

' Helper function to convert hex color to RGB
Private Function HexToRGB(hexColor As String) As Long
    Dim r As Integer, g As Integer, b As Integer
    
    r = Val("&H" & Mid(hexColor, 1, 2))
    g = Val("&H" & Mid(hexColor, 3, 2))
    b = Val("&H" & Mid(hexColor, 5, 2))
    
    HexToRGB = RGB(r, g, b)
End Function

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