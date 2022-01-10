import React from "react";
import { Gantt, Task, EventOption, StylingOption, ViewMode, DisplayOption } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import initTasks, { TaskE } from "../assets/tasks";

//const currentDate = new Date();


function GanttComponent() {

    const [tasks, setTasks] = React.useState<Task[]>(initTasks);
   // const [view, setView] = React.useState<ViewMode>(ViewMode.Day);
    const [isChecked, setIsChecked] = React.useState(true);

    //const view = ViewMode.Week;
    const view = ViewMode.Month;

    const onTaskChange = ( () => {console.log("Changed Task")})
    const onTaskDelete = ( () => {console.log("Deleted Task")})
    const onProgressChange = ( (task: Task) => {console.log("Progess changed")})
    const onDblClick = ( (task: Task) => {console.log("doubleClikc")})

    const handleExpanderClick = (task: Task) => {
        setTasks(tasks.map(t => (t.id === task.id ? task : t)));
        console.log("On expander click Id:" + task.id);
      };
    //const viewMode = 

    // viewMode={view} onDateChange={onTaskChange} onTaskDelete={onTaskDelete}
    return (
        <div>
         <Gantt
            tasks={tasks}
            viewMode={view}
            onProgressChange={onProgressChange}
            onDoubleClick={onDblClick}
            onDelete={onTaskDelete}
            onExpanderClick={handleExpanderClick}
            listCellWidth={"155px"}
            columnWidth={80}
            rtl={false}
            fontSize={"12px"}
            rowHeight={20}
            headerHeight={80}
        />
        </div>
        
    );
}

export default GanttComponent;