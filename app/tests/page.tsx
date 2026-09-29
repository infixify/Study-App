{/* Only show Subject Marks breakdown for FULL SYLLABUS tests */}
              {scope === "full_syllabus" && (
                <div className="p-3 rounded-xl bg-paper/60 border border-ink/8 mb-3">
                  <p className="text-[11px] font-bold text-ink mb-1.5">
                    Subject Marks (Optional Breakdown)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[9.5px] font-bold text-slate block mb-0.5">
                        Physics
                      </span>
                      <input
                        type="number"
                        placeholder="0"
                        value={pMarks}
                        onChange={(e) => setPMarks(e.target.value)}
                        className="w-full text-center text-xs font-bold p-2 rounded-lg border border-ink/15 bg-white focus:outline-none focus:border-teal"
                      />
                    </div>
                    <div>
                      <span className="text-[9.5px] font-bold text-slate block mb-0.5">
                        Chemistry
                      </span>
                      <input
                        type="number"
                        placeholder="0"
                        value={cMarks}
                        onChange={(e) => setCMarks(e.target.value)}
                        className="w-full text-center text-xs font-bold p-2 rounded-lg border border-ink/15 bg-white focus:outline-none focus:border-teal"
                      />
                    </div>
                    <div>
                      <span className="text-[9.5px] font-bold text-slate block mb-0.5">
                        Maths / Bio
                      </span>
                      <input
                        type="number"
                        placeholder="0"
                        value={mMarks}
                        onChange={(e) => setMMarks(e.target.value)}
                        className="w-full text-center text-xs font-bold p-2 rounded-lg border border-ink/15 bg-white focus:outline-none focus:border-teal"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Guidance for Chapter Scope */}
              {scope === "chapter" && (
                <div className="p-3 bg-teal/10 border border-teal/20 rounded-xl flex items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-[11px] font-bold text-teal-900 leading-tight">
                      Chapter Micro Practice & Revision?
                    </p>
                    <p className="text-[10px] text-slate mt-0.5">
                      Log questions directly under chapter card in Syllabus.
                    </p>
                  </div>
                  <a
                    href="/library"
                    className="px-3 py-1.5 bg-teal text-white rounded-lg text-[10px] font-extrabold hover:bg-teal/90 transition-all shrink-0"
                  >
                    Go to Syllabus ➔
                  </a>
                </div>
              )}
