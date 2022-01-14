import React from 'react'
import 'react-medium-image-zoom/dist/styles.css'



interface IModalWithCB {
  id: string
  pos: number
  thumbnail: any
  fullpath: any
  efficacy: number
  closeCB: Function
}

interface IData {
  data: IModalWithCB
}


export default function Modal({data}: IData) {
 //  
    const pillColor = "red";

    return (
        <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto'>
        <div
            className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
        >




        <div className="px-6 py-4">
            <div className="font-bold text-xl mb-2">{data.id}-{data.pos}</div>
            <p className="text-gray-700 text-base">
              Wellaflex

            </p>
        </div>
        <div className="px-6 pt-4 pb-2">
            <span className={"inline-block "+pillColor+" rounded-full px-3 py-1 text-sm font-semibold text-white mr-2 mb-2"}>Efficacy {data.efficacy}</span>
        </div>

        <button
          className="bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 border border-gray-400 rounded shadow"
          onClick={()=>(data.closeCB(false))}
        >
          Close
        </button>

        </div>
        </div>

    )
}
