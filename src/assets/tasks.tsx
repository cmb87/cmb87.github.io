import { Task } from 'gantt-task-react';


export interface TaskE extends Task {
  cost: number;
  effort: number;
  description: string;
}


let initTasks: TaskE[] = [
  // ======================================
  // ============== Analytik ==============
  {
    start: new Date(2022, 0, 1),
    end: new Date(2022, 11, 20),
    name: "Dach",
    id: "wp1",
    progress: 1,
    type: "project",
    hideChildren: false,
    cost: 3000,
    effort: 3,
    description: "hdwdwd"
  },
  {
    start: new Date(2022, 1, 1),
    end: new Date(2022, 11, 20),
    name: "Photovoltaik",
    id: "wp2",
    progress: 1,
    type: "project",
    hideChildren: false,
    effort: 3,
    cost: 3000,
    description: "hdwdwd"
  },
  {
    start: new Date(2022, 1, 1),
    end: new Date(2022, 10, 20),
    name: "Heizung",
    id: "wp3",
    progress: 1,
    type: "project",
    hideChildren: false,
    effort: 3,
    cost: 3000,
    description: "hdwdwd"
  },
  {
    start: new Date(2022, 1, 1),
    end: new Date(2022, 2, 1),
    name: "Angebot Terrassendämmung",
    project: "wp3",
    id: '3t4',
    type:'task',
    progress: 0,
    isDisabled: false,
    styles: { progressColor: '#ffbb54', progressSelectedColor: '#ff9e0d' },
    cost: 3000,
    effort: 3,
    description: "hdwdwd"
  },
  {
    start: new Date(2022, 1, 1),
    end: new Date(2022, 2, 1),
    name: "Wasserführender Kamin?",
    project: "wp3",
    id: '3t1',
    type:'task',
    progress: 0,
    isDisabled: false,
    styles: { progressColor: '#ffbb54', progressSelectedColor: '#ff9e0d' },
    cost: 3000,
    effort: 3,
    description: "hdwdwd"
  },

  {
    start: new Date(2022, 1, 1),
    end: new Date(2022, 2, 1),
    name: "Wandheizung möglich?",
    project: "wp3",
    id: '3t2',
    type:'task',
    progress: 0,
    isDisabled: false,
    styles: { progressColor: '#ffbb54', progressSelectedColor: '#ff9e0d' },
    cost: 3000,
    effort: 3,
    description: "hdwdwd"
  },
  {
    start: new Date(2022, 1, 15),
    end: new Date(2022, 1, 15),
    name: "Parkett noch vergübar?",
    id: "m30a",
    project: "wp3",
    progress: 1,
    type: "milestone",
    cost: 3000,
    effort: 3,
    description: "hdwdwd"
  },
  {
    start: new Date(2022, 1, 15),
    end: new Date(2022, 1, 15),
    name: "Alter Parkett und Fliesen entfernbar?",
    id: "m30b",
    project: "wp3",
    progress: 1,
    type: "milestone",
    cost: 3000,
    effort: 3,
    description: "hdwdwd"
  },
  {
    start: new Date(2022, 1, 15),
    end: new Date(2022, 2, 1),
    name: "Angebot FBH WoZi",
    project: "wp3",
    id: '3t3',
    type:'task',
    progress: 0,
    dependencies: ["m30a","m30b"],
    isDisabled: false,
    styles: { progressColor: '#ffbb54', progressSelectedColor: '#ff9e0d' },
    cost: 3000,
    effort: 3,
    description: "hdwdwd"
  },
  {
    start: new Date(2022, 1, 1),
    end: new Date(2022, 2, 1),
    name: "Angebot FBH Kellerbad",
    project: "wp3",
    id: '3t5',
    type:'task',
    progress: 0,
    isDisabled: false,
    styles: { progressColor: '#ffbb54', progressSelectedColor: '#ff9e0d' },
    cost: 3000,
    effort: 3,
    description: "hdwdwd"
  },
  {
    start: new Date(2022, 2, 15),
    end: new Date(2022, 2, 15),
    name: "Entscheidung Wärmepumpe oder Pellets",
    project: "wp3",
    id: "m31",
    progress: 1,
    dependencies: ["3t1", "3t2", "3t3", "3t4"],
    type: "milestone",
    cost: 3000,
    effort: 3,
    description: "hdwdwd"
  },

];


export default initTasks
