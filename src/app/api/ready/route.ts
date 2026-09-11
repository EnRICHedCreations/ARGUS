import { NextResponse } from "next/server";
import { getObservations } from "@/lib/memory";
export async function GET(){try{const observations=await getObservations();return NextResponse.json({ready:true,persistentMemory:true,observations:observations.length,llmProvider:"none"});}catch(error){return NextResponse.json({ready:false,error:String(error)},{status:503});}}
