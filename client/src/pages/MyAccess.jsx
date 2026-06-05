import React from 'react';

const MyAccess = ({ user }) => {
    return (
        <div className="p-6">
            <div className="bg-white rounded-[2rem] shadow-lg p-8">

                <h1 className="text-3xl font-black text-slate-800 mb-6">
                    My Access
                </h1>

                <div className="grid md:grid-cols-2 gap-6">

                    <div className="bg-blue-50 rounded-2xl p-5">
                        <p className="text-sm text-slate-500">
                            Login User
                        </p>

                        <p className="text-xl font-bold text-slate-800">
                            {user?.email}
                        </p>
                    </div>

                    <div className="bg-purple-50 rounded-2xl p-5">
                        <p className="text-sm text-slate-500">
                            Role
                        </p>

                        <p className="text-xl font-bold text-purple-700 uppercase">
                            {user?.type}
                        </p>
                    </div>

                </div>

                <div className="mt-8">
                    <h2 className="text-xl font-bold mb-4">
                        Customer Access Details
                    </h2>

                    <div className="flex flex-wrap gap-3">
                        {user?.allowedCustomers?.length > 0 ? (
                            user.allowedCustomers.map((customer) => (
                                <span
                                    key={customer}
                                    className="px-4 py-2 rounded-xl bg-green-100 text-green-800 font-medium"
                                >
                                    {customer}
                                </span>
                            ))
                        ) : (
                            <p className="text-slate-500">
                                No customer access assigned
                            </p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default MyAccess;