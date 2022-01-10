import React from 'react'
import DataTable from 'react-data-table-component';
import initTasks from "../assets/tasks";
import {useEffect, useMemo, useState} from "react";


const columns = [

    {
      id: 1,
      name: "Name",
      selector: (row: any) => row.name,
      sortable: true,
      reorder: true
    },
    {
      id: 2,
      name: "Type",
      selector: (row: any) => row.type,
      sortable: true,
      reorder: true
    },
    {
      id: 3,
      name: "Cost",
      selector: (row: any) => row.cost,
      sortable: true,
      reorder: true
    },
    {
        id: 4,
        name: "URL",
        cell: (row: any) => row.id
        ? <p>{row.id}</p>
        : <span>loading...</span>,
        minWidth: '20em'
      }
  ];







export default function Table() {

    var tasks = initTasks.filter( t => t.type == "task")

    return (
        <div>
            <DataTable
            title="Tasks"
            columns={columns}
            data={tasks}
            defaultSortFieldId={1}
            pagination
            //selectableRows
            />
        </div>
    )
}
