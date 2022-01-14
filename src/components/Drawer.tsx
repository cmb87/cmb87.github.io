import React, {useRef, useEffect, useState} from 'react'
import thumbnail from '../assets/image1_thumbnail.png'


// https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
// https://hashnode.blainegarrett.com/html-5-canvas-react-refs-and-typescript-ckf4jju8r00eypos1gyisenyf
// https://blog.cloudboost.io/using-html5-canvas-with-react-ff7d93f5dc76
// https://koenvangilst.nl/blog/react-hooks-with-canvas

export interface IBox {
    x: number,
    y: number,
    width: number,
    height: number,
    label: string
}


export interface IDrawer {
  boxes: IBox[],
  setBoxes: Function,
  setBoxIdx: Function,
  width: number,
  height: number,
}


export default function Drawer({boxes, setBoxes, setBoxIdx, width, height}:IDrawer) {

    const canvasSize = {x: width, y:height}

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);

    // const [boxes, setBoxesCb] = useState< IBox[]>([])
    const [boxDraft, setBoxDraft] = useState<IBox | null>()

    const [buttonPressed, setButtonPressed] = useState(false)
    const [cursor, setCursor] = useState("help")
    const [idxHover, setIdxHover] = useState(-1)

    const [x0, setX0] = useState< number[]>([])
    const [xoffset, setXoffset] = useState({ x: 0, y: 0 })


    // -----------------------------------
    // For dealing with the field
    const getWindowsSize = () => {
      if (canvasRef.current) {
        const {left, top} = canvasRef.current.getBoundingClientRect()
        setXoffset( old => ({...old, x: left, y: top }))
      }
    }

    useEffect(() => {
      getWindowsSize();
      window.addEventListener("resize", getWindowsSize)
      window.addEventListener("scroll", getWindowsSize)
    }, [])


    useEffect(() => {
    }, [xoffset])

    // -----------------------------------
    // Draw it
    useEffect(() => {
      if (canvasRef.current) {
        canvasCtxRef.current = canvasRef.current.getContext('2d');
        let ctx = canvasCtxRef.current;
        canvasRef.current!.oncontextmenu = function(e) { e.preventDefault(); e.stopPropagation(); }

        let img = new Image();
        img.src = thumbnail;

        img.onload = () => {
          ctx!.drawImage(img, 0, 0, width, height)
          ctx!.strokeStyle = "#FF0000";
          for (const b of boxes) { ctx!.strokeRect(b.x, b.y, b.width, b.height);}
          if (boxDraft) ctx!.strokeRect(boxDraft.x, boxDraft.y, boxDraft.width, boxDraft.height);
          if (idxHover != -1) {
            ctx!.strokeStyle = " #FFFF00";
            ctx!.fillStyle = 'rgba(225,225,225,0.5)';
            ctx!.strokeRect(boxes[idxHover].x, boxes[idxHover].y, boxes[idxHover].width, boxes[idxHover].height);
            ctx!.fillRect(boxes[idxHover].x, boxes[idxHover].y, boxes[idxHover].width, boxes[idxHover].height);
            ctx!.font = '12px Comic Sans MS';
            ctx!.fillStyle = "red";
            ctx!.fillText(boxes[idxHover].label, boxes[idxHover].x, boxes[idxHover].y);
          }
        }

      }
    }, [boxes, boxDraft, idxHover])

    // -----------------------------------
    const btnDown = (x:number, y:number, button:number) => {
      if ( button == 0 ) {
        getWindowsSize();
        setX0([
          Math.round(x-xoffset.x),
          Math.round(y-xoffset.y)
        ])
        setButtonPressed(true);
        setCursor("crosshair");
      } else if ( idxHover != -1 ) {
        console.log("selecting box", idxHover)
      }

    }

    // -----------------------------------
    const btnUp = (x:number, y:number, button:number) => {
      if ( button == 0 ) {
        const x1 = [x-xoffset.x, y-xoffset.y];

        const box: IBox = {
          x: Math.round(Math.min(x1[0], x0[0])),
          y: Math.round(Math.min(x1[1], x0[1])),
          width: Math.round(Math.abs(x1[0] - x0[0])),
          height: Math.round( Math.abs(x1[1] - x0[1])),
          label: "myzus"
        }
        if (box.width>0 && box.height >0) {
          setBoxes(box)
        } 
        setButtonPressed(false);
        setBoxDraft(null);
        setCursor("help");
      }
    }

    // -----------------------------------
    const btnDownMouseMove = (x:number, y:number) => {

      const x1 = [x-xoffset.x, y-xoffset.y];

      if ( buttonPressed ) {

        const box: IBox = {
          x: Math.min(x1[0], x0[0]),
          y: Math.min(x1[1], x0[1]),
          width: Math.round(Math.abs(x1[0] - x0[0])),
          height: Math.round( Math.abs(x1[1] - x0[1])),
          label: ""
        }
        setBoxDraft(box)
    
      } else {

        const idx = boxes.findIndex(b => {
          return Math.abs(b.x+0.5*b.width - x1[0]) <= 0.5*b.width && Math.abs(b.y+0.5*b.height - x1[1]) <= 0.5*b.height
        })

        setIdxHover(idx)
        setBoxIdx(idx)

      }
    }
    // -----------------------------------
    return (
        <div>
          <canvas ref={canvasRef} width={canvasSize.x} height={canvasSize.y}
            onMouseDown={(e) => {btnDown(e.nativeEvent.clientX, e.nativeEvent.clientY, e.button);}}
            onMouseUp={(e) => {btnUp(e.nativeEvent.clientX, e.nativeEvent.clientY, e.button);}}
            onMouseMove={(e) => {btnDownMouseMove(e.nativeEvent.clientX, e.nativeEvent.clientY);}}
            style={{ cursor: cursor }}
          />
        </div>
    )
}
